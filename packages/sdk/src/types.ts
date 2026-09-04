/** Unified init options — same shape on web, Node, and React Native. */
export type PaaqInitOptions = {
  sdkToken: string
  projectId: string
  platform?: string
  environment?: 'production' | 'staging' | 'development'
  appVersion?: string
  debug?: boolean
}

export type {
  ErrorPayload,
  EventPayload,
  InitResult,
  PaaqConfig,
  PaaqEnvironment,
} from '@paaq/sdk-core'
