export type PaaqEnvironment = 'production' | 'staging' | 'development'

export type EventPayload = {
  event_name: string
  session_id: string | null
  user_id?: string | null
  properties: Record<string, unknown>
  timestamp: string
}

export type ErrorPayload = {
  error_type: string
  message: string
  stack_trace?: string | null
  screen?: string | null
  severity?: 'fatal' | 'error' | 'warning' | 'info'
  context?: Record<string, unknown> | null
  session_id?: string | null
}

export type PaaqConfig = {
  batchSize: number
  syncIntervalSeconds: number
}

export type InitResult = {
  ok: boolean
  sessionId?: string
  deviceId?: string
  config?: PaaqConfig
  error?: string
}

export type InitOptions = {
  sdkToken: string
  projectId: string
  platform?: string
  environment?: PaaqEnvironment
}

export type SdkCredentials = {
  sdkToken: string
  projectId: string
  platform: string
  environment: PaaqEnvironment
  sdkVersion: string
}

export type SdkHeaders = Record<string, string>
