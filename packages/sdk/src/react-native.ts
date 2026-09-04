export {
  PAAQ,
  PaaqTouchTracker,
  initialize,
  track,
  identify,
  screen,
  flush,
  dispose,
  endSession,
  trackNavigationScreen,
  trackScrollDepth,
  resetScrollTracking,
  trackFieldFocus,
  trackFieldBackspace,
  trackFieldBlur,
  trackFormAbandon,
} from '../../react-native-sdk/src/index'

export type { InitOptions as PaaqInitOptions, InitResult } from '../../react-native-sdk/src/index'
export type { PaaqConfig } from '@paaq/sdk-core'
