#!/usr/bin/env node
/**
 * PAAQ Intelligence CLI
 *
 * Usage:
 *   node packages/cli/index.js connect
 *   node packages/cli/index.js verify  --sdk-token sdk_live_xxx --project-key proj_xxx
 *   node packages/cli/index.js snippet --sdk-token sdk_live_xxx --project-key proj_xxx --framework nextjs
 *   node packages/cli/index.js test    --sdk-token sdk_live_xxx --project-key proj_xxx
 */

import { readFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'

const PAAQ_BASE = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1'

const CYAN  = '\x1b[36m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const YELLOW= '\x1b[33m'
const BOLD  = '\x1b[1m'
const DIM   = '\x1b[2m'
const RESET = '\x1b[0m'

const c = (color, text) => `${color}${text}${RESET}`
const log = (...args) => console.log(...args)
const err = (...args) => console.error(c(RED, '✗'), ...args)
const ok  = (...args) => console.log(c(GREEN, '✓'), ...args)
const info= (...args) => console.log(c(CYAN, '→'), ...args)

// ── Framework detection ─────────────────────────────────────────────────────
function detectFramework() {
  const cwd = process.cwd()
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps['next'])              return 'nextjs'
    if (deps['nuxt'])              return 'vue'
    if (deps['@angular/core'])     return 'vanilla'
    if (deps['react'])             return 'react'
    if (deps['vue'])               return 'vue'
    if (deps['express'] || deps['fastify'] || deps['hono']) return 'nodejs'
  } catch {}
  if (existsSync(join(cwd, 'requirements.txt')) || existsSync(join(cwd, 'pyproject.toml'))) return 'python'
  return null
}

// ── Prompt helper ──────────────────────────────────────────────────────────
async function prompt(question, defaultValue) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    const display = defaultValue ? `${question} ${c(DIM, `[${defaultValue}]`)} ` : `${question} `
    rl.question(display, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

// ── API calls ──────────────────────────────────────────────────────────────
async function verifyCredentials(sdkToken, projectKey) {
  const res = await fetch(`${PAAQ_BASE}/sdk-init`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${sdkToken}`,
      'X-Project-ID':  projectKey,
      'X-SDK-Version': '1.0.0',
      'X-Platform':    'nodejs',
      'X-Environment': 'production',
    },
    body: JSON.stringify({ sessionId: crypto.randomUUID() }),
  })
  return res.json()
}

async function sendTestEvent(projectKey) {
  const res = await fetch(`${PAAQ_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': projectKey },
    body: JSON.stringify({
      event_name:  'paaq_cli_test',
      session_id:  crypto.randomUUID(),
      screen_name: '/cli-test',
      properties:  { source: 'paaq-cli', version: '0.1.0', timestamp: new Date().toISOString() },
    }),
  })
  return res.json()
}

// ── Snippet generators ─────────────────────────────────────────────────────
function generateSnippet(framework, sdkToken, projectKey) {
  const snippets = {
    nextjs: `// lib/paaq.ts
export const paaq = {
  sdkToken:   '${sdkToken}',
  projectKey: '${projectKey}',
  base:       '${PAAQ_BASE}',
  sessionId:  typeof crypto !== 'undefined' ? crypto.randomUUID() : '',
  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID': this.projectKey,
        'X-SDK-Version': '1.0.0', 'X-Platform': 'nextjs', 'X-Environment': process.env.NODE_ENV ?? 'production',
      },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },
  async track(eventName, properties = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: eventName, session_id: this.sessionId, screen_name: '/', properties }),
    }).catch(() => null)
  },
}
// In app/layout.tsx: add 'use client', import { useEffect } from 'react', import { paaq } from '@/lib/paaq'
// Then inside the layout: useEffect(() => { paaq.init() }, [])`,

    react: `// src/paaq.js
export const paaq = {
  sdkToken: '${sdkToken}', projectKey: '${projectKey}',
  base: '${PAAQ_BASE}', sessionId: crypto.randomUUID(),
  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID': this.projectKey, 'X-SDK-Version': '1.0.0', 'X-Platform': 'react', 'X-Environment': import.meta.env.MODE },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },
  async track(name, props = {}) {
    await fetch(\`\${this.base}/events\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: name, session_id: this.sessionId, screen_name: location.pathname, properties: props }),
    }).catch(() => null)
  },
}
// In src/main.jsx: import { paaq } from './paaq'; paaq.init()`,

    vanilla: `<!-- Paste before </body> in your HTML -->
<script>
const PAAQ = {
  sdkToken: '${sdkToken}', projectKey: '${projectKey}',
  base: '${PAAQ_BASE}', sessionId: crypto.randomUUID(),
  async init() {
    await fetch(this.base + '/sdk-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.sdkToken,
        'X-Project-ID': this.projectKey, 'X-SDK-Version': '1.0.0', 'X-Platform': 'vanilla', 'X-Environment': 'production' },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => null)
  },
  async track(name, props) {
    await fetch(this.base + '/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
      body: JSON.stringify({ event_name: name, session_id: this.sessionId, screen_name: location.pathname, properties: props }),
    }).catch(() => null)
  },
}
PAAQ.init()
PAAQ.track('page_view', { title: document.title })
</script>`,

    nodejs: `// paaq.js
export const paaq = {
  sdkToken: '${sdkToken}', projectKey: '${projectKey}', base: '${PAAQ_BASE}',
  async init() {
    await fetch(\`\${this.base}/sdk-init\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${this.sdkToken}\`,
        'X-Project-ID': this.projectKey, 'X-SDK-Version': '1.0.0', 'X-Platform': 'nodejs', 'X-Environment': process.env.NODE_ENV },
      body: JSON.stringify({}),
    }).catch(() => null)
  },
  middleware() {
    return (req, res, next) => {
      const start = Date.now()
      res.on('finish', () => {
        fetch(\`\${this.base}/events\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.projectKey },
          body: JSON.stringify({ event_name: 'api_request', properties: { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start } }),
        }).catch(() => null)
      })
      next()
    }
  },
}
// In server.js: import { paaq } from './paaq.js'; await paaq.init(); app.use(paaq.middleware())`,

    python: `# paaq.py
import httpx, uuid

class PAAQ:
    SDK_TOKEN = '${sdkToken}'
    PROJECT_KEY = '${projectKey}'
    BASE = '${PAAQ_BASE}'
    session_id = str(uuid.uuid4())

    @classmethod
    def init(cls):
        httpx.post(f'{cls.BASE}/sdk-init', headers={
            'Authorization': f'Bearer {cls.SDK_TOKEN}', 'X-Project-ID': cls.PROJECT_KEY,
            'X-SDK-Version': '1.0.0', 'X-Platform': 'python', 'X-Environment': 'production',
        }, json={'sessionId': cls.session_id}, timeout=5)

    @classmethod
    def track(cls, event_name, properties={}):
        httpx.post(f'{cls.BASE}/events', headers={'x-api-key': cls.PROJECT_KEY},
            json={'event_name': event_name, 'session_id': cls.session_id, 'properties': properties}, timeout=5)
# In main.py: from paaq import PAAQ; PAAQ.init()`,
  }
  return snippets[framework] ?? null
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdConnect() {
  log('')
  log(c(BOLD, c(CYAN, '  PAAQ Intelligence — Connect your app')))
  log(c(DIM, '  ─────────────────────────────────────'))
  log('')

  // Detect framework
  const detected = detectFramework()
  if (detected) info(`Detected framework: ${c(BOLD, detected)}`)

  const frameworkChoices = 'nextjs / react / vue / vanilla / nodejs / python'
  const framework = await prompt(`  Framework ${c(DIM, `(${frameworkChoices})`)}:`, detected ?? '')
  if (!generateSnippet(framework, '', '')) {
    err(`Unknown framework "${framework}". Choose from: ${frameworkChoices}`)
    process.exit(1)
  }

  log('')
  info('Paste your credentials from the app management page in PAAQ Intelligence')
  const sdkToken   = await prompt('  SDK Token   (sdk_live_...):')
  const projectKey = await prompt('  Project Key (proj_...):')

  if (!sdkToken.startsWith('sdk_live_') && !sdkToken.startsWith('sdk_test_')) {
    err('SDK token must start with sdk_live_ or sdk_test_')
    process.exit(1)
  }
  if (!projectKey.startsWith('proj_')) {
    err('Project key must start with proj_')
    process.exit(1)
  }

  // Verify credentials
  log('')
  info('Verifying credentials…')
  let verifyResult
  try {
    verifyResult = await verifyCredentials(sdkToken, projectKey)
  } catch {
    err('Could not reach PAAQ Intelligence API. Check your internet connection.')
    process.exit(1)
  }

  if (!verifyResult.ok) {
    err(`Credential check failed: ${verifyResult.error}`)
    process.exit(1)
  }
  ok(`Connected to project: ${c(BOLD, verifyResult.meta?.projectName)} (${verifyResult.meta?.plan} plan)`)

  // Output snippet
  log('')
  log(c(BOLD, `  Integration snippet for ${framework}:`))
  log(c(DIM, '  ─────────────────────────────────────'))
  log('')
  log(generateSnippet(framework, sdkToken, projectKey))
  log('')

  // Send test event
  const doTest = await prompt('  Send a test event now to verify? (y/n):', 'y')
  if (doTest.toLowerCase() === 'y') {
    try {
      const result = await sendTestEvent(projectKey)
      if (result.ok) ok('Test event received by PAAQ Intelligence — check your dashboard!')
      else err(`Test event failed: ${result.error}`)
    } catch {
      err('Could not send test event')
    }
  }

  log('')
  ok(c(BOLD, 'Done! Check your app management page in PAAQ Intelligence for live connection status.'))
  log('')
}

async function cmdVerify(args) {
  const sdkToken   = args['--sdk-token']   ?? args['-s']
  const projectKey = args['--project-key'] ?? args['-p']
  if (!sdkToken || !projectKey) { err('Usage: paaq verify --sdk-token sdk_live_xxx --project-key proj_xxx'); process.exit(1) }
  info('Verifying credentials…')
  const result = await verifyCredentials(sdkToken, projectKey)
  if (result.ok) ok(`Valid — Project: ${result.meta?.projectName}, Plan: ${result.meta?.plan}`)
  else { err(result.error); process.exit(1) }
}

async function cmdSnippet(args) {
  const sdkToken   = args['--sdk-token']   ?? args['-s']
  const projectKey = args['--project-key'] ?? args['-p']
  const framework  = args['--framework']   ?? args['-f']
  if (!sdkToken || !projectKey || !framework) {
    err('Usage: paaq snippet --sdk-token sdk_live_xxx --project-key proj_xxx --framework nextjs')
    process.exit(1)
  }
  const code = generateSnippet(framework, sdkToken, projectKey)
  if (!code) { err(`Unknown framework: ${framework}`); process.exit(1) }
  log(code)
}

async function cmdTest(args) {
  const projectKey = args['--project-key'] ?? args['-p']
  if (!projectKey) { err('Usage: paaq test --project-key proj_xxx'); process.exit(1) }
  info('Sending test event…')
  const result = await sendTestEvent(projectKey)
  if (result.ok) ok('Test event received! Check your PAAQ Intelligence dashboard.')
  else { err(result.error); process.exit(1) }
}

// ── Entrypoint ─────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2)
const command = rawArgs[0]

// Parse --flag value args
const args = {}
for (let i = 1; i < rawArgs.length; i++) {
  if (rawArgs[i].startsWith('-')) args[rawArgs[i]] = rawArgs[i + 1] ?? true
}

if (!command || command === 'help' || command === '--help') {
  log('')
  log(c(BOLD, c(CYAN, '  paaq — PAAQ Intelligence CLI')))
  log('')
  log('  Commands:')
  log(`    ${c(CYAN, 'connect')}                              Interactive setup wizard`)
  log(`    ${c(CYAN, 'verify')}  --sdk-token --project-key   Test your credentials`)
  log(`    ${c(CYAN, 'snippet')} --sdk-token --project-key   Output integration code`)
  log(`             --framework [nextjs|react|vue|vanilla|nodejs|python]`)
  log(`    ${c(CYAN, 'test')}    --project-key               Send a test event`)
  log('')
  process.exit(0)
}

if (command === 'connect') await cmdConnect()
else if (command === 'verify')  await cmdVerify(args)
else if (command === 'snippet') await cmdSnippet(args)
else if (command === 'test')    await cmdTest(args)
else { err(`Unknown command: ${command}. Run: paaq help`); process.exit(1) }
