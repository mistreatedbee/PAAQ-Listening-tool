/** Edge function paths — same contract for web, app, server, and database connectors. */
export const PAAQ_ENDPOINTS = {
  sdkInit: '/sdk-init',
  events: '/events',
  errors: '/errors',
  heartbeat: '/sdk-heartbeat',
  sessions: '/sessions',
  users: '/users',
  performance: '/performance',
  sessionRecordingUpload: '/session-recording-upload',
  dbConnector: '/db-connector',
} as const

export type PaaqEndpoint = keyof typeof PAAQ_ENDPOINTS
