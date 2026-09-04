#!/usr/bin/env node
/**
 * Push REPO_CONNECTOR_INTERNAL_SECRET from /.env.local to Supabase and redeploy
 * edge functions that validate x-internal-secret.
 *
 * Run after pasting the Production secret from Vercel into /.env.local
 */
import { execSync } from 'child_process'
import { loadSdkReleaseEnv, ROOT } from './load-env.mjs'

loadSdkReleaseEnv()

const secret = process.env.REPO_CONNECTOR_INTERNAL_SECRET?.trim()
if (!secret) {
  console.error('Set REPO_CONNECTOR_INTERNAL_SECRET in /.env.local first (Vercel Production value).')
  process.exit(1)
}

const projectRef = 'mookyonwpovxscsbqwwl'
const apiDir = `${ROOT}/apps/api`

console.log('Setting Supabase secret REPO_CONNECTOR_INTERNAL_SECRET…')
execSync(`supabase secrets set REPO_CONNECTOR_INTERNAL_SECRET="${secret.replace(/"/g, '\\"')}" --project-ref ${projectRef}`, {
  cwd: apiDir,
  stdio: 'inherit',
})

const functions = [
  'announce-sdk-release',
  'repo-connector',
  'onboard-agent',
  'execute-fix',
  'generate-insights-cron',
  'autonomous-merge-cron',
  'session-recording-cleanup-cron',
  'session-sweep-cron',
  'session-recording-delete',
  'db-heartbeat-cron',
].join(' ')

console.log('\nRedeploying edge functions so they pick up the new secret…')
execSync(`supabase functions deploy ${functions} --project-ref ${projectRef}`, {
  cwd: apiDir,
  stdio: 'inherit',
})

console.log('\nDone. Also set the same value in Vercel Production if you rotated it.')
