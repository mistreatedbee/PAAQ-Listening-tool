import type { PaaqConfig } from './types'

export const DEFAULT_BASE_URL = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

export const SDK_CORE_VERSION = '1.0.0'

export const DEFAULT_PAAQ_CONFIG: PaaqConfig = {
  batchSize: 50,
  syncIntervalSeconds: 30,
}

/** Matches server/RN/web heartbeat cadence (5 minutes). */
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000
