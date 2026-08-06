/**
 * PAAQ Platform Health — real, server-side reachability probes for the admin
 * System Health page. Every row reports a genuine measured result; there is
 * no synthetic/fixed status or latency anywhere in this function. Where no
 * real integration exists to probe (Stripe, Agora — neither is wired into
 * this codebase), the caller renders "not monitored", never a fabricated
 * "healthy".
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type Probe = { ok: boolean; latencyMs?: number; error?: string }

async function timed(fn: () => Promise<void>): Promise<Probe> {
  const start = Date.now()
  try {
    await fn()
    return { ok: true, latencyMs: Date.now() - start }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}

async function probeRealtime(): Promise<Probe> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  return timed(() => new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sb.removeAllChannels()
      reject(new Error('Realtime subscribe timed out'))
    }, 3000)
    sb.channel('platform-health-probe')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout)
          sb.removeAllChannels()
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout)
          sb.removeAllChannels()
          reject(new Error(`Realtime channel status: ${status}`))
        }
      })
  }))
}

async function probeStorage(): Promise<Probe> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  return timed(async () => {
    const { error } = await sb.storage.listBuckets()
    if (error) throw new Error(error.message)
  })
}

async function probeAuth(): Promise<Probe> {
  return timed(async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`)
    if (!res.ok) throw new Error(`Auth settings endpoint returned ${res.status}`)
  })
}

async function probeClaude(): Promise<Probe> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not set' }
  const anthropic = new Anthropic({ apiKey })
  return timed(async () => {
    await anthropic.models.list()
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const [realtime, storage, auth, claude] = await Promise.all([
    probeRealtime(),
    probeStorage(),
    probeAuth(),
    probeClaude(),
  ])

  return new Response(JSON.stringify({ realtime, storage, auth, claude }), {
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
