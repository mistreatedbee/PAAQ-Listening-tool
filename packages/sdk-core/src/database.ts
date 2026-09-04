/** Supported read-only database engines — matches db-connector / onboard-agent. */
export const DATABASE_ENGINES = [
  'postgres',
  'supabase',
  'mysql',
  'mongodb',
  'sqlite',
  'redis',
] as const

export type DatabaseEngine = (typeof DATABASE_ENGINES)[number]

export type TableInfo = {
  name: string
  columns: string[]
}

export type DatabaseIntrospection = {
  engine: DatabaseEngine
  host?: string | null
  database?: string | null
  tables: TableInfo[]
  status: 'connected' | 'error' | 'pending'
}

export type DatabaseConnectRequest = {
  projectId: string
  engine: DatabaseEngine
  connectionString: string
}

export type DatabaseConnectResult =
  | { ok: true; tables: TableInfo[] }
  | { ok: false; error: string; step?: 'connect' | 'introspect' | 'readonly' }
