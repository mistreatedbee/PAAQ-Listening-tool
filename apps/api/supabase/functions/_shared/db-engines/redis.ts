// deno-lint-ignore-file no-explicit-any
import { connect } from 'https://deno.land/x/redis@v0.32.1/mod.ts'
import { isTransient } from '../retry.ts'
import type { DbAdapter, IntrospectResult, TableInfo, TestResult } from './types.ts'

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/NOAUTH|WRONGPASS|invalid password/i.test(msg)) return 'Authentication failed — check the password'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|connection refused/i.test(msg)) return 'Could not reach host — check hostname and port'
  return msg.slice(0, 200)
}

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /NOPERM|NOAUTH|no permissions/i.test(msg)
}

function parseRedisUrl(connStr: string) {
  const url = new URL(connStr)
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:',
  }
}

async function withConn<T>(connStr: string, fn: (r: any) => Promise<T>): Promise<T> {
  const { hostname, port, password, username, tls } = parseRedisUrl(connStr)
  const redis = await connect({ hostname, port, password, username, tls })
  try {
    return await fn(redis)
  } finally {
    try { redis.close() } catch { /* ignore */ }
  }
}

export async function testConnection(connStr: string): Promise<TestResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await withConn(connStr, async (r) => { await r.ping() })
      return { ok: true }
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        await new Promise((r) => setTimeout(r, 300))
        continue
      }
      return { ok: false, error: friendlyError(err) }
    }
  }
  return { ok: false, error: 'Could not reach host — check hostname and port' }
}

export async function introspectSchema(connStr: string): Promise<IntrospectResult> {
  try {
    const tables = await withConn(connStr, async (r) => {
      const keys: string[] = []
      let cursor = '0'
      do {
        const [nextCursor, batch] = await r.scan(cursor, { count: 100 })
        cursor = nextCursor
        keys.push(...batch)
      } while (cursor !== '0' && keys.length < 500)
      // Redis has no tables/columns — report key name patterns only. Never
      // GET/HGETALL/LRANGE/etc, so "never row data" is structurally
      // guaranteed by simply never importing those command wrappers.
      return [{ name: 'keys', columns: keys.slice(0, 500) }] as TableInfo[]
    })
    return { ok: true, tables }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

export async function verifyReadOnly(connStr: string, _tables: TableInfo[]): Promise<TestResult> {
  try {
    return await withConn(connStr, async (r) => {
      try {
        await r.set('__paaq_probe__', '1')
        try { await r.del('__paaq_probe__') } catch { /* ignore */ }
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

export const redisAdapter: DbAdapter = { testConnection, introspectSchema, verifyReadOnly }
