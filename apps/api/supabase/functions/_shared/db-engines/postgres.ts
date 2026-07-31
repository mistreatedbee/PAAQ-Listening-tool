import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts'
import { isTransient } from '../retry.ts'
import type { DbAdapter, IntrospectResult, TableInfo, TestResult } from './types.ts'

function isPermissionError(err: unknown): boolean {
  const code = (err as { fields?: { code?: string } })?.fields?.code
  if (code === '42501') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /permission denied/i.test(msg)
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/password authentication failed/i.test(msg)) return 'Authentication failed — check username/password'
  if (/could not translate host|does not resolve|ENOTFOUND|ECONNREFUSED|timeout/i.test(msg)) {
    return 'Could not reach host — check hostname and port'
  }
  return msg.slice(0, 200)
}

/** Table/column identifiers come from information_schema, but treat as untrusted anyway. */
function quoteIdent(id: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) throw new Error(`Unsafe identifier: ${id}`)
  return `"${id}"`
}

export async function testConnection(connStr: string): Promise<TestResult> {
  // At most one retry, and only for a transient network failure — a real
  // auth/permission rejection must fail on the first attempt, never be
  // masked by a delayed retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = new Client(connStr)
    try {
      await client.connect()
      await client.queryObject('SELECT 1')
      return { ok: true }
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        await new Promise((r) => setTimeout(r, 300))
        continue
      }
      return { ok: false, error: friendlyError(err) }
    } finally {
      try { await client.end() } catch { /* ignore */ }
    }
  }
  return { ok: false, error: 'Could not reach host — check hostname and port' }
}

export async function introspectSchema(connStr: string): Promise<IntrospectResult> {
  const client = new Client(connStr)
  try {
    await client.connect()
    const result = await client.queryObject<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name, ordinal_position
    `)
    const map = new Map<string, string[]>()
    for (const row of result.rows) {
      if (!map.has(row.table_name)) map.set(row.table_name, [])
      map.get(row.table_name)!.push(row.column_name)
    }
    const tables: TableInfo[] = [...map.entries()].map(([name, columns]) => ({ name, columns }))
    return { ok: true, tables }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}

export async function verifyReadOnly(connStr: string, tables: TableInfo[]): Promise<TestResult> {
  const client = new Client(connStr)
  try {
    await client.connect()

    const usable = tables.find((t) => t.columns.length > 0)
    if (usable) {
      const table = quoteIdent(usable.name)
      const col = quoteIdent(usable.columns[0])
      try {
        // Matches zero rows even if it were permitted — this only tests
        // whether Postgres rejects it for permission reasons.
        await client.queryObject(`UPDATE ${table} SET ${col} = ${col} WHERE false`)
        return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
      } catch (err) {
        if (isPermissionError(err)) return { ok: true }
        return { ok: false, error: friendlyError(err) }
      }
    }

    // No usable table found — probe with a temp table instead.
    try {
      await client.queryObject('CREATE TEMP TABLE __paaq_probe__ (x int)')
      try { await client.queryObject('DROP TABLE __paaq_probe__') } catch { /* ignore */ }
      return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
    } catch (err) {
      if (isPermissionError(err)) return { ok: true }
      return { ok: false, error: friendlyError(err) }
    }
  } finally {
    try { await client.end() } catch { /* ignore */ }
  }
}

export const postgresAdapter: DbAdapter = { testConnection, introspectSchema, verifyReadOnly }
