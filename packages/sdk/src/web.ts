import { paaq, SDK_VERSION_STRING } from '../../../apps/sdk-web/src/index'
import type { PaaqInitOptions } from './types'

export type { PaaqInitOptions, InitResult, PaaqConfig } from './types'
export { SDK_VERSION_STRING }

/** @deprecated Use `PAAQ.initialize()` — kept for existing web integrations. */
export { paaq }

export async function initialize(options: PaaqInitOptions) {
  return paaq.init(options.sdkToken, options.projectId, {
    platform: options.platform ?? 'web',
    appVersion: options.appVersion,
  })
}

export const PAAQ = {
  initialize,
  track: paaq.track.bind(paaq),
  identify: paaq.identify.bind(paaq),
  page: paaq.page.bind(paaq),
  flush: paaq.flush.bind(paaq),
  trackError: paaq.trackError.bind(paaq),
  endSession: paaq.endSession.bind(paaq),
}
