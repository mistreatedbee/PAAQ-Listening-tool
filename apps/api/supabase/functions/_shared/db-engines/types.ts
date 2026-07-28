export type TableInfo = { name: string; columns: string[] }

export type TestResult = { ok: true } | { ok: false; error: string }
export type IntrospectResult = { ok: true; tables: TableInfo[] } | { ok: false; error: string }

export interface DbAdapter {
  testConnection(connStr: string): Promise<TestResult>
  introspectSchema(connStr: string): Promise<IntrospectResult>
  verifyReadOnly(connStr: string, tables: TableInfo[]): Promise<TestResult>
}

/** Categories the dashboard maps to specific inline validation messages. */
export type ErrorCategory =
  | 'invalid_auth'
  | 'unsupported_engine'
  | 'bad_host'
  | 'auth_failed'
  | 'not_read_only'
  | 'unknown'

export function categorizeError(message: string): ErrorCategory {
  const m = message.toLowerCase()
  if (m.includes('write access') || m.includes('not read-only') || m.includes('not read only')) return 'not_read_only'
  if (m.includes('password') || m.includes('auth') || m.includes('access denied') || m.includes('unauthorized') || m.includes('noperm') || m.includes('noauth')) return 'auth_failed'
  if (m.includes('could not reach') || m.includes('host') || m.includes('econnrefused') || m.includes('enotfound') || m.includes('timeout')) return 'bad_host'
  return 'unknown'
}
