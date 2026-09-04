import { PAAQ as NodePAAQ } from '../../server-sdk/src/index'
import type { PaaqInitOptions } from './types'

export type { PaaqInitOptions, InitResult, PaaqConfig } from './types'

export async function initialize(options: PaaqInitOptions) {
  return NodePAAQ.initialize({
    sdkToken: options.sdkToken,
    projectId: options.projectId,
    platform: options.platform ?? 'nodejs',
    environment: options.environment,
  })
}

export const PAAQ = {
  initialize,
  track: NodePAAQ.track.bind(NodePAAQ),
  identify: NodePAAQ.identify.bind(NodePAAQ),
  flush: NodePAAQ.flush.bind(NodePAAQ),
  shutdown: NodePAAQ.shutdown.bind(NodePAAQ),
  trackError: NodePAAQ.trackError.bind(NodePAAQ),
  middleware: NodePAAQ.middleware.bind(NodePAAQ),
}
