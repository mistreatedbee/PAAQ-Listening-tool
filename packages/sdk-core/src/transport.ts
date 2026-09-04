import { DEFAULT_BASE_URL, DEFAULT_PAAQ_CONFIG } from './constants'
import { buildSdkHeaders } from './headers'
import { PAAQ_ENDPOINTS } from './protocol'
import type {
  ErrorPayload,
  EventPayload,
  InitResult,
  PaaqConfig,
  PaaqEnvironment,
  SdkCredentials,
} from './types'

export type PaaqTransportOptions = {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export type SdkInitBody = {
  deviceId: string
  deviceMetadata?: Record<string, unknown>
  appVersion?: string
}

/**
 * Shared HTTP client for every JavaScript/TypeScript PAAQ surface
 * (web, React Native app, Node server). Native iOS/Android/Flutter mirror
 * the same endpoints and headers.
 */
export class PaaqTransport {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private credentials: SdkCredentials | null = null

  constructor(options: PaaqTransportOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  setCredentials(credentials: SdkCredentials): void {
    this.credentials = credentials
  }

  getCredentials(): SdkCredentials | null {
    return this.credentials
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    if (!this.credentials) throw new Error('PAAQ SDK not configured — call setCredentials first')
    return { ...buildSdkHeaders(this.credentials), ...extra }
  }

  async sdkInit(body: SdkInitBody): Promise<InitResult> {
    try {
      const res = await this.fetchImpl(this.url(PAAQ_ENDPOINTS.sdkInit), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      })
      return (await res.json()) as InitResult
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  async postEvents(events: EventPayload[]): Promise<void> {
    if (events.length === 0) return
    try {
      await this.fetchImpl(this.url(PAAQ_ENDPOINTS.events), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(events),
      })
    } catch {
      // fire-and-forget
    }
  }

  async postError(payload: ErrorPayload): Promise<void> {
    try {
      await this.fetchImpl(this.url(PAAQ_ENDPOINTS.errors), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      })
    } catch {
      // fire-and-forget
    }
  }

  async heartbeat(deviceId: string): Promise<void> {
    try {
      await this.fetchImpl(this.url(PAAQ_ENDPOINTS.heartbeat), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ deviceId }),
      })
    } catch {
      // fire-and-forget
    }
  }

  async endSession(
    sessionId: string,
    durationSeconds?: number,
    outcome = 'completed',
    options: { keepalive?: boolean } = {},
  ): Promise<void> {
    try {
      await this.fetchImpl(this.url(PAAQ_ENDPOINTS.sessions), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          action: 'end',
          session_id: sessionId,
          duration: durationSeconds,
          outcome,
        }),
        keepalive: options.keepalive ?? false,
      })
    } catch {
      // fire-and-forget
    }
  }

  async linkSessionToUser(sessionId: string, userId: string): Promise<boolean> {
    try {
      const res = await this.fetchImpl(this.url(PAAQ_ENDPOINTS.sessions), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ action: 'identify', session_id: sessionId, user_id: userId }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async resolveUser(externalUserId: string, email?: string): Promise<{ ok: boolean; userId?: string; error?: string }> {
    try {
      const res = await this.fetchImpl(this.url(PAAQ_ENDPOINTS.users), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ external_user_id: externalUserId, email }),
      })
      const data = (await res.json()) as { ok?: boolean; user_id?: string; error?: string }
      if (!data.ok || !data.user_id) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
      return { ok: true, userId: data.user_id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  async postPerformance(metrics: Record<string, unknown> | Record<string, unknown>[]): Promise<void> {
    try {
      await this.fetchImpl(this.url(PAAQ_ENDPOINTS.performance), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(metrics),
      })
    } catch {
      // fire-and-forget
    }
  }

  async uploadSessionRecording(
    sessionId: string,
    batch: unknown[],
    options: { sequence: number; capturedAt: string; keepalive?: boolean } ,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      session_id: sessionId,
      kind: 'dom',
      sequence: String(options.sequence),
      captured_at: options.capturedAt,
    })
    try {
      const creds = this.credentials
      if (!creds) return false
      const res = await this.fetchImpl(this.url(`${PAAQ_ENDPOINTS.sessionRecordingUpload}?${params}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.sdkToken}`,
          'X-Project-ID': creds.projectId,
        },
        body: JSON.stringify(batch),
        keepalive: options.keepalive ?? true,
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export function createCredentials(
  sdkToken: string,
  projectId: string,
  platform: string,
  sdkVersion: string,
  environment: PaaqEnvironment = 'production',
): SdkCredentials {
  return { sdkToken, projectId, platform, sdkVersion, environment }
}

export function normalizeConfig(config?: PaaqConfig): PaaqConfig {
  return {
    batchSize: config?.batchSize ?? DEFAULT_PAAQ_CONFIG.batchSize,
    syncIntervalSeconds: config?.syncIntervalSeconds ?? DEFAULT_PAAQ_CONFIG.syncIntervalSeconds,
  }
}
