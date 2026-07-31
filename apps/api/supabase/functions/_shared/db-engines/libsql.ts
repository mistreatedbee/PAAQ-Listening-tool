// deno-lint-ignore-file no-explicit-any
// "SQLite" in the UI means libSQL/Turso — a networked, SQLite-compatible
// service. Plain local .sqlite files aren't reachable from an edge function.
import { createClient } from 'npm:@libsql/client'
import { isTransient } from '../retry.ts'
import type { DbAdapter, IntrospectResult, TableInfo, TestResult } from './types.ts'

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/unauthorized|auth/i.test(msg)) return 'Authentication failed — check the auth token'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return 'Could not reach host — check the database URL'
  return msg.slice(0, 200)
}

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /permission|readonly|read-only|unauthorized|forbidden/i.test(msg)
}

function quoteIdent(id: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) throw new Error(`Unsafe identifier: ${id}`)
  return `"${id}"`
}

export async function testConnection(connStr: string): Promise<TestResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = createClient({ url: connStr })
    try {
      await client.execute('SELECT 1')
      return { ok: true }
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        await new Promise((r) => setTimeout(r, 300))
        continue
      }
      return { ok: false, error: friendlyError(err) }
    } finally {
      client.close()
    }
  }
  return { ok: false, error: 'Could not reach host — check the database URL' }
}

export async function introspectSchema(connStr: string): Promise<IntrospectResult> {
  const client = createClient({ url: connStr })
  try {
    const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    const tables: TableInfo[] = []
    for (const row of tablesResult.rows as any[]) {
      const name = row.name as string
      const colsResult = await client.execute(`PRAGMA table_info(${quoteIdent(name)})`)
      const columns = (colsResult.rows as any[]).map((r) => r.name as string)
      tables.push({ name, columns })
    }
    return { ok: true, tables }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  } finally {
    client.close()
  }
}

export async function verifyReadOnly(connStr: string, tables: TableInfo[]): Promise<TestResult> {
  const client = createClient({ url: connStr })
  try {
    const usable = tables.find((t) => t.columns.length > 0)
    if (usable) {
      const table = quoteIdent(usable.name)
      const col = quoteIdent(usable.columns[0])
      try {
        await client.execute(`UPDATE ${table} SET ${col} = ${col} WHERE 0`)
        return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
      } catch (err) {
        if (isPermissionError(err)) return { ok: true }
        return { ok: false, error: friendlyError(err) }
      }
    }
    try {
      await client.execute('CREATE TEMP TABLE __paaq_probe__ (x int)')
      try { await client.execute('DROP TABLE __paaq_probe__') } catch { /* ignore */ }
      return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
    } catch (err) {
      if (isPermissionError(err)) return { ok: true }
      return { ok: false, error: friendlyError(err) }
    }
  } finally {
    client.close()
  }
}

export const libsqlAdapter: DbAdapter = { testConnection, introspectSchema, verifyReadOnly }
