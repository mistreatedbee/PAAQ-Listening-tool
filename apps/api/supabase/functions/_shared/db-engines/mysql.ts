// deno-lint-ignore-file no-explicit-any
import mysql from 'npm:mysql2@3/promise'
import type { DbAdapter, IntrospectResult, TableInfo, TestResult } from './types.ts'

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/ER_ACCESS_DENIED_ERROR|Access denied/i.test(msg)) return 'Authentication failed — check username/password'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return 'Could not reach host — check hostname and port'
  return msg.slice(0, 200)
}

function isPermissionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  if (code === 'ER_TABLEACCESS_DENIED_ERROR' || code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR') return true
  return /access denied/i.test(err instanceof Error ? err.message : String(err))
}

function quoteIdent(id: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) throw new Error(`Unsafe identifier: ${id}`)
  return `\`${id}\``
}

async function withConnection<T>(connStr: string, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await mysql.createConnection(connStr)
  try {
    return await fn(conn)
  } finally {
    try { await conn.end() } catch { /* ignore */ }
  }
}

export async function testConnection(connStr: string): Promise<TestResult> {
  try {
    await withConnection(connStr, async (conn) => { await conn.query('SELECT 1') })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function introspectSchema(connStr: string): Promise<IntrospectResult> {
  try {
    const tables = await withConnection(connStr, async (conn) => {
      const [rows] = await conn.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position`,
      )
      const map = new Map<string, string[]>()
      for (const row of rows as { table_name: string; column_name: string }[]) {
        if (!map.has(row.table_name)) map.set(row.table_name, [])
        map.get(row.table_name)!.push(row.column_name)
      }
      return [...map.entries()].map(([name, columns]): TableInfo => ({ name, columns }))
    })
    return { ok: true, tables }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function verifyReadOnly(connStr: string, tables: TableInfo[]): Promise<TestResult> {
  try {
    return await withConnection(connStr, async (conn) => {
      const usable = tables.find((t) => t.columns.length > 0)
      if (usable) {
        const table = quoteIdent(usable.name)
        const col = quoteIdent(usable.columns[0])
        try {
          await conn.query(`UPDATE ${table} SET ${col} = ${col} WHERE 1 = 0`)
          return { ok: false, error: 'This connection string has WRITE access. PAAQ requires a read-only user.' }
        } catch (err) {
          if (isPermissionError(err)) return { ok: true }
          return { ok: false, error: friendlyError(err) }
        }
      }
      try {
        await conn.query('CREATE TEMPORARY TABLE __paaq_probe__ (x INT)')
        try { await conn.query('DROP TEMPORARY TABLE __paaq_probe__') } catch { /* ignore */ }
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

export const mysqlAdapter: DbAdapter = { testConnection, introspectSchema, verifyReadOnly }
