import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { Settings, Key, Copy, Terminal } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'

type Project = {
  id: string
  name: string
  api_key: string
  platform: string
  created_at: string
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, api_key, platform, created_at')
    .order('created_at', { ascending: false })

  const projectRows = (projects ?? []) as Project[]

  const installSnippet = projectRows[0]
    ? `await Listening.initialize(\n  apiKey: '${projectRows[0].api_key}',\n  projectId: '${projectRows[0].id}',\n);`
    : `await Listening.initialize(\n  apiKey: 'YOUR_API_KEY',\n  projectId: 'YOUR_PROJECT_ID',\n);`

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title="Project Settings"
        desc="Manage connected applications, API keys and SDK installation."
        actions={<ToneBadge tone="healthy" dot>{projectRows.length} project{projectRows.length !== 1 ? 's' : ''} connected</ToneBadge>}
      />

      {/* Connected Projects */}
      <Card>
        <CardHead
          title="Connected Projects"
          desc="Applications sending data to the PAAQ Listening Platform."
          icon={<Key className="h-4 w-4 text-intel" />}
        />
        {projectRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Key className="h-8 w-8 opacity-20" />
            <p className="text-sm">No projects yet.</p>
            <p className="text-xs">Run the seed SQL in database/seed.sql to create a demo project.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {projectRows.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <ToneBadge tone="intel">{p.platform}</ToneBadge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">ID: {p.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded border border-border/60 bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
                    {p.api_key.slice(0, 12)}••••••••
                  </code>
                  <ToneBadge tone="healthy" dot>Active</ToneBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* SDK Installation */}
      <Card>
        <CardHead
          title="Flutter SDK Installation"
          desc="Add the PAAQ Listening SDK to your Flutter application."
          icon={<Terminal className="h-4 w-4 text-ai" />}
        />
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Add dependency</p>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted p-4 font-mono text-sm text-foreground">
              {`dependencies:\n  paaq_listening_sdk:\n    git:\n      url: https://github.com/mistreatedbee/PAAQ-Listening-tool\n      path: packages/flutter-sdk`}
            </pre>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Initialize in main.dart</p>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted p-4 font-mono text-sm text-foreground">
              {`import 'package:paaq_listening_sdk/paaq_listening_sdk.dart';\n\nFuture<void> main() async {\n  WidgetsFlutterBinding.ensureInitialized();\n  ${installSnippet}\n  runApp(const MyApp());\n}`}
            </pre>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">3. Track events</p>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted p-4 font-mono text-sm text-foreground">
              {`// Identify user\nListening.identify('user_123', email: 'user@example.com');\n\n// Track screen\nListening.screen('Dashboard');\n\n// Track custom event\nListening.track('button_click', {'button': 'submit'});\n\n// Errors are captured automatically via FlutterError.onError`}
            </pre>
          </div>
        </div>
      </Card>

      {/* API Endpoints */}
      <Card>
        <CardHead title="API Endpoints" desc="Supabase Edge Function endpoints for direct integration." />
        <ul className="divide-y divide-border/40">
          {[
            { method: 'POST', path: '/functions/v1/events', desc: 'Ingest user events (batch supported)' },
            { method: 'POST', path: '/functions/v1/errors', desc: 'Report application errors' },
            { method: 'POST', path: '/functions/v1/sessions', desc: 'Start or end user sessions' },
            { method: 'POST', path: '/functions/v1/performance', desc: 'Send performance metrics' },
          ].map((e) => (
            <li key={e.path} className="flex items-center gap-4 px-5 py-3">
              <span className="shrink-0 rounded border border-intel/30 bg-intel/10 px-2 py-0.5 font-mono text-xs font-semibold text-intel">
                {e.method}
              </span>
              <code className="flex-1 font-mono text-xs text-foreground">{e.path}</code>
              <span className="text-xs text-muted-foreground hidden sm:block">{e.desc}</span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-5 pt-3">
          <p className="text-xs text-muted-foreground">
            All endpoints require an <code className="rounded bg-muted px-1 py-0.5 font-mono">x-api-key</code> header with your project API key.
            Base URL: <code className="rounded bg-muted px-1 py-0.5 font-mono">https://mookyonwpovxscsbqwwl.supabase.co</code>
          </p>
        </div>
      </Card>
    </div>
  )
}
