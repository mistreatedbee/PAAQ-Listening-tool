import type { SdkCredentials, SdkHeaders } from './types'

/** Standard auth + telemetry headers for every PAAQ edge function call. */
export function buildSdkHeaders(credentials: SdkCredentials): SdkHeaders {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credentials.sdkToken}`,
    'X-Project-ID': credentials.projectId,
    'X-SDK-Version': credentials.sdkVersion,
    'X-Platform': credentials.platform,
    'X-Environment': credentials.environment,
  }
}
