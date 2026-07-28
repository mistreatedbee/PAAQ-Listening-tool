// deno-lint-ignore-file no-explicit-any
import { MongoClient } from 'npm:mongodb@6'
import type { DbAdapter, IntrospectResult, TableInfo, TestResult } from './types.ts'

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/auth failed|authentication failed|bad auth/i.test(msg)) return 'Authentication failed — check username/password'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|querySrv/i.test(msg)) return 'Could not reach host — check hostname and port'
  return msg.slice(0, 200)
}

function isPermissionError(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  return code === 13 || /not authorized/i.test(err instanceof Error ? err.message : String(err))
}

async function withClient<T>(connStr: string, fn: (client: any) => Promise<T>): Promise<T> {
  const client = new MongoClient(connStr)
  try {
    await client.connect()
    return await fn(client)
  } finally {
    try { await client.close() } catch { /* ignore */ }
  }
}

export async function testConnection(connStr: string): Promise<TestResult> {
  try {
    await withClient(connStr, async (client) => { await client.db().command({ ping: 1 }) })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function introspectSchema(connStr: string): Promise<IntrospectResult> {
  try {
    const tables = await withClient(connStr, async (client) => {
      const collections = await client.db().listCollections().toArray()
      // MongoDB has no fixed schema — v1 reports collection names only.
      // Reading field names would require sampling documents, which
      // conflicts with "never row data".
      return collections.map((c: { name: string }): TableInfo => ({ name: c.name, columns: [] }))
    })
    return { ok: true, tables }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function verifyReadOnly(connStr: string, tables: TableInfo[]): Promise<TestResult> {
  try {
    return await withClient(connStr, async (client) => {
      const collectionName = tables[0]?.name ?? '__paaq_probe__'
      const collection = client.db().collection(collectionName)
      try {
        // Filter matches nothing, so this is a real no-op write attempt
        // even if it were permitted — we only care whether it's rejected.
        await collection.updateOne({ _id: '__paaq_probe_no_match__' }, { $set: { x: 1 } })
        return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
      } catch (err) {
        if (isPermissionError(err)) return { ok: true }
        return { ok: false, error: friendlyError(err) }
      }
    })
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export const mongodbAdapter: DbAdapter = { testConnection, introspectSchema, verifyReadOnly }
