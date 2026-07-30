'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import {
  Sparkles, Building2, Globe, Server, Smartphone, Boxes,
  Check, Copy, Loader2, ArrowRight, Key, AlertTriangle,
  Download, CheckCircle2, BarChart3, Activity, Flame, X,
} from 'lucide-react'
import {
  SiReact, SiNextdotjs, SiVuedotjs, SiAngular, SiJavascript,
  SiFlutter, SiApple, SiAndroid,
  SiNodedotjs, SiPython, SiGo, SiOpenjdk, SiDotnet,
} from 'react-icons/si'

// ─── Theme tokens (designer's light theme) ────────────────────────────────────

const C = {
  bg: '#f5f8fb',
  border: 'rgba(15,27,42,0.08)',
  borderStrong: 'rgba(15,27,42,0.15)',
  textPrimary: '#0f1b2a',
  textSecondary: '#4a5a6b',
  textMuted: '#7a8fa3',
  textPlaceholder: '#a0b0c0',
  teal: '#27a6ce',
  tealSoft: 'rgba(39,166,206,0.08)',
  green: '#16a34a',
  greenSoft: 'rgba(22,163,74,0.08)',
  yellow: '#ca8a04',
  red: '#dc2626',
  redSoft: 'rgba(220,38,38,0.08)',
}

const TEAL_GRADIENT = 'linear-gradient(135deg,#27a6ce,#51c9d3)'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'welcome' | 'org' | 'product' | 'sdk' | 'done'

interface OrgData { company: string; industry: string; country: string; website: string; teamSize: string }
interface ProductData { projectName: string; productType: string; technology: string; environment: 'production' | 'staging' }
interface Credentials { projectId: string; sdkToken: string; publicKey: string; secretKey: string; webhookSecret: string }

// ─── Data ─────────────────────────────────────────────────────────────────────

type TechOption = { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string; platformId: string }

const TECH: Record<string, TechOption[]> = {
  website: [
    { Icon: SiReact,     color: '#61DAFB', label: 'React',      platformId: 'react' },
    { Icon: SiNextdotjs, color: '#111827', label: 'Next.js',    platformId: 'nextjs' },
    { Icon: SiVuedotjs,  color: '#42B883', label: 'Vue',        platformId: 'vue' },
    { Icon: SiAngular,   color: '#DD0031', label: 'Angular',    platformId: 'angular' },
    { Icon: SiJavascript,color: '#F7DF1E', label: 'Vanilla JS', platformId: 'vanilla' },
  ],
  mobile: [
    { Icon: SiFlutter,   color: '#02569B', label: 'Flutter',      platformId: 'flutter' },
    { Icon: SiReact,     color: '#61DAFB', label: 'React Native', platformId: 'reactnative' },
    { Icon: SiApple,     color: '#111827', label: 'iOS',          platformId: 'ios' },
    { Icon: SiAndroid,   color: '#3DDC84', label: 'Android',      platformId: 'android' },
  ],
  backend: [
    { Icon: SiNodedotjs, color: '#5FA04E', label: 'Node.js', platformId: 'nodejs' },
    { Icon: SiPython,    color: '#3776AB', label: 'Python',  platformId: 'python' },
    { Icon: SiGo,        color: '#00ADD8', label: 'Go',      platformId: 'go' },
    { Icon: SiOpenjdk,   color: '#ED8B00', label: 'Java',    platformId: 'java' },
    { Icon: SiDotnet,    color: '#512BD4', label: '.NET',    platformId: 'dotnet' },
  ],
  platform: [
    { Icon: SiReact,     color: '#61DAFB', label: 'React',   platformId: 'react' },
    { Icon: SiNextdotjs, color: '#111827', label: 'Next.js', platformId: 'nextjs' },
    { Icon: SiVuedotjs,  color: '#42B883', label: 'Vue',     platformId: 'vue' },
    { Icon: SiFlutter,   color: '#02569B', label: 'Flutter', platformId: 'flutter' },
    { Icon: SiNodedotjs, color: '#5FA04E', label: 'Node.js', platformId: 'nodejs' },
    { Icon: SiPython,    color: '#3776AB', label: 'Python',  platformId: 'python' },
    { Icon: SiGo,        color: '#00ADD8', label: 'Go',      platformId: 'go' },
  ],
}

const ALL_TECH = [...TECH.website, ...TECH.mobile, ...TECH.backend]

const PRODUCT_TYPES = [
  { id: 'website',  Icon: Globe,      label: 'Website',       desc: 'React, Next.js, Vue and more' },
  { id: 'mobile',   Icon: Smartphone, label: 'Mobile app',    desc: 'Flutter, native iOS or Android' },
  { id: 'backend',  Icon: Server,     label: 'Backend API',   desc: 'Node.js, Python, Go and more' },
  { id: 'platform', Icon: Boxes,      label: 'Full platform', desc: 'A connected web, mobile and API stack' },
]

const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Media', 'Gaming', 'Education', 'FinTech', 'HealthTech', 'EdTech', 'Marketplace', 'Real Estate', 'Travel', 'Other']
const COUNTRIES  = ['United States', 'United Kingdom', 'South Africa', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Nigeria', 'Kenya', 'Other']
const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '200+']

// ─── Install snippets ─────────────────────────────────────────────────────────

type InstallStep = { title: string; note?: string; code?: string }
type SnippetResult = { cmd: string; init: string; steps?: InstallStep[] }

function installSnippet(platformId: string, sdkToken: string, projectId: string): SnippetResult {
  const t = sdkToken || 'sdk_live_your_token_here'
  const p = projectId || 'proj_your_id'
  switch (platformId) {
    case 'react': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function App() {\n  return (\n    <PAAQProvider sdkToken="${t}" projectId="${p}">\n      <YourApp />\n    </PAAQProvider>\n  );\n}`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open the Terminal app on your Mac (press ⌘+Space, type "Terminal", hit Enter). Then navigate to your project folder and run:',
          code: 'npm install @paaq/web-sdk',
        },
        {
          title: 'Step 2 — Wrap your app with PAAQ',
          note: 'Open your main App.jsx (or App.tsx) file. Your credentials are already filled in — just paste this:',
          code: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function App() {\n  return (\n    <PAAQProvider sdkToken="${t}" projectId="${p}">\n      <YourApp />\n    </PAAQProvider>\n  );\n}`,
        },
      ],
    }
    case 'nextjs': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html><body>\n      <PAAQProvider sdkToken="${t}" projectId="${p}">\n        {children}\n      </PAAQProvider>\n    </body></html>\n  );\n}`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Next.js project folder and run:',
          code: 'npm install @paaq/web-sdk',
        },
        {
          title: 'Step 2 — Add to your root layout',
          note: 'Open app/layout.tsx (or app/layout.js) and wrap children with PAAQProvider — your credentials are already filled in:',
          code: `import { PAAQProvider } from '@paaq/web-sdk';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html><body>\n      <PAAQProvider sdkToken="${t}" projectId="${p}">\n        {children}\n      </PAAQProvider>\n    </body></html>\n  );\n}`,
        },
      ],
    }
    case 'vue': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { createApp } from 'vue';\nimport { PAAQPlugin } from '@paaq/web-sdk';\n\nconst app = createApp(App);\napp.use(PAAQPlugin, { sdkToken: '${t}', projectId: '${p}' });\napp.mount('#app');`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Vue project folder and run:',
          code: 'npm install @paaq/web-sdk',
        },
        {
          title: 'Step 2 — Register the PAAQ plugin',
          note: 'Open src/main.js (or main.ts) and add the PAAQ plugin — your credentials are already filled in:',
          code: `import { createApp } from 'vue';\nimport { PAAQPlugin } from '@paaq/web-sdk';\n\nconst app = createApp(App);\napp.use(PAAQPlugin, { sdkToken: '${t}', projectId: '${p}' });\napp.mount('#app');`,
        },
      ],
    }
    case 'angular': return {
      cmd: 'npm install @paaq/web-sdk',
      init: `import { PAAQ } from '@paaq/web-sdk';\n\n// In main.ts\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Angular project folder and run:',
          code: 'npm install @paaq/web-sdk',
        },
        {
          title: 'Step 2 — Initialize in main.ts',
          note: 'Open src/main.ts and add these two lines before bootstrapApplication:',
          code: `import { PAAQ } from '@paaq/web-sdk';\n\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });`,
        },
      ],
    }
    case 'vanilla': return {
      cmd: '<!-- No install needed — just paste into your HTML -->',
      init: `<script type="module">\n  import { PAAQ } from 'https://unpkg.com/@paaq/web-sdk@1.0.0/dist/index.mjs';\n  PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\n</script>`,
      steps: [
        {
          title: 'Step 1 — Open your website\'s HTML file',
          note: 'Find your main HTML file (usually index.html) and open it in any text editor — Notepad on Windows, TextEdit on Mac, or any code editor.',
        },
        {
          title: 'Step 2 — Paste this code just before </body>',
          note: 'Scroll to the very bottom of the file. Find the </body> tag and paste this code right above it. No npm or build tools needed:',
          code: `<script type="module">\n  import { PAAQ } from 'https://unpkg.com/@paaq/web-sdk@1.0.0/dist/index.mjs';\n  PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\n</script>`,
        },
        {
          title: 'Step 3 — Save and reload your page',
          note: 'Save the file, then open or refresh your website in a browser. PAAQ will start tracking automatically — click "Verify connection" below to confirm it worked.',
        },
      ],
    }
    case 'flutter': return {
      cmd: 'flutter pub add paaq_intelligence',
      init: `import 'package:paaq_intelligence/paaq_intelligence.dart';\n\nvoid main() async {\n  WidgetsFlutterBinding.ensureInitialized();\n  await PAAQ.initialize(sdkToken: '${t}', projectId: '${p}');\n  runApp(const MyApp());\n}`,
      steps: [
        {
          title: 'Step 1 — Add PAAQ to your Flutter project',
          note: 'Open Terminal in your Flutter project folder and run this command:',
          code: 'flutter pub add paaq_intelligence',
        },
        {
          title: 'Step 2 — Initialize in main.dart',
          note: 'Open lib/main.dart. Find the main() function and update it — your credentials are already filled in:',
          code: `import 'package:paaq_intelligence/paaq_intelligence.dart';\n\nvoid main() async {\n  WidgetsFlutterBinding.ensureInitialized();\n  await PAAQ.initialize(sdkToken: '${t}', projectId: '${p}');\n  runApp(const MyApp());\n}`,
        },
      ],
    }
    case 'reactnative': return {
      cmd: 'npm install @paaq/react-native-sdk @react-native-async-storage/async-storage',
      init: `import { PAAQ } from '@paaq/react-native-sdk';\n\nuseEffect(() => {\n  PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\n}, []);`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your React Native project folder and run:',
          code: 'npm install @paaq/react-native-sdk @react-native-async-storage/async-storage',
        },
        {
          title: 'Step 2 — Link native modules (iOS only)',
          note: 'If your app targets iOS, run this once to link the native storage module:',
          code: 'cd ios && pod install && cd ..',
        },
        {
          title: 'Step 3 — Initialize in your App.tsx',
          note: 'Open App.tsx (or App.js) and add PAAQ inside a useEffect hook — your credentials are already filled in:',
          code: `import { PAAQ } from '@paaq/react-native-sdk';\n\nuseEffect(() => {\n  PAAQ.initialize({\n    sdkToken: '${t}',\n    projectId: '${p}',\n  });\n}, []);`,
        },
      ],
    }
    case 'ios': return {
      cmd: 'https://github.com/mistreatedbee/paaq-intelligence-ios',
      init: `import PaaqIntelligence\n\n@main\nstruct MyApp: App {\n  init() {\n    Task {\n      await PAAQ.initialize(\n        sdkToken: "${t}",\n        projectId: "${p}"\n      )\n    }\n  }\n  var body: some Scene {\n    WindowGroup { ContentView() }\n  }\n}`,
      steps: [
        {
          title: 'Step 1 — Open Xcode and add the package',
          note: 'In Xcode, click File in the top menu → Add Package Dependencies. In the search box (top right of the dialog), paste this URL and press Enter:',
          code: 'https://github.com/mistreatedbee/paaq-intelligence-ios',
        },
        {
          title: 'Step 2 — Select version and add',
          note: 'In the dialog: set version to "Up to Next Major Version" from 1.0.0. Make sure PaaqIntelligence is ticked as the target. Click Add Package.',
        },
        {
          title: 'Step 3 — Initialize in your app',
          note: 'Open the Swift file marked with @main (usually YourAppName.swift). Replace or update the struct to look like this — your credentials are already filled in:',
          code: `import PaaqIntelligence\n\n@main\nstruct MyApp: App {\n  init() {\n    Task {\n      await PAAQ.initialize(\n        sdkToken: "${t}",\n        projectId: "${p}"\n      )\n    }\n  }\n  var body: some Scene {\n    WindowGroup { ContentView() }\n  }\n}`,
        },
      ],
    }
    case 'android': return {
      cmd: `implementation("com.github.mistreatedbee:paaq-intelligence-android:1.0.0")`,
      init: `import io.paaq.intelligence.PAAQ\n\nclass MyApplication : Application() {\n  override fun onCreate() {\n    super.onCreate()\n    PAAQ.initialize(\n      context = this,\n      sdkToken = "${t}",\n      projectId = "${p}"\n    )\n  }\n}`,
      steps: [
        {
          title: 'Step 1 — Add JitPack repository',
          note: 'Open settings.gradle.kts (in the root of your Android project — not the app/ folder). Find the repositories block and add the JitPack line:',
          code: `dependencyResolutionManagement {\n    repositories {\n        google()\n        mavenCentral()\n        maven { url = uri("https://jitpack.io") }  // add this line\n    }\n}`,
        },
        {
          title: 'Step 2 — Add the PAAQ package',
          note: 'Open build.gradle.kts inside the app/ folder. Find the dependencies { } block and add this line:',
          code: `dependencies {\n    implementation("com.github.mistreatedbee:paaq-intelligence-android:1.0.0")\n}`,
        },
        {
          title: 'Step 3 — Sync and initialize',
          note: 'Click "Sync Now" when Android Studio prompts you. Then open (or create) Application.kt and add your PAAQ setup — credentials already filled in:',
          code: `import io.paaq.intelligence.PAAQ\n\nclass MyApplication : Application() {\n  override fun onCreate() {\n    super.onCreate()\n    PAAQ.initialize(\n      context = this,\n      sdkToken = "${t}",\n      projectId = "${p}"\n    )\n  }\n}`,
        },
      ],
    }
    case 'nodejs': return {
      cmd: 'npm install @paaq/server-sdk',
      init: `import { PAAQ } from '@paaq/server-sdk';\n\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\napp.use(PAAQ.middleware());`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Node.js project folder and run:',
          code: 'npm install @paaq/server-sdk',
        },
        {
          title: 'Step 2 — Initialize in your server file',
          note: 'Open your main server file (usually index.js, server.js, or app.js) and add these lines at the very top:',
          code: `import { PAAQ } from '@paaq/server-sdk';\n\nPAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });\n\n// Automatically tracks every API request:\napp.use(PAAQ.middleware());`,
        },
      ],
    }
    case 'python': return {
      cmd: 'pip install paaq-server-sdk',
      init: `from paaq import PAAQ\n\nPAAQ.initialize(sdk_token='${t}', project_id='${p}')`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Python project folder and run:',
          code: 'pip install paaq-server-sdk',
        },
        {
          title: 'Step 2 — Initialize at startup',
          note: 'At the top of your main Python file (e.g. main.py, app.py), add:',
          code: `from paaq import PAAQ\n\nPAAQ.initialize(sdk_token='${t}', project_id='${p}')`,
        },
      ],
    }
    case 'go': return {
      cmd: 'go get github.com/paaq/go-sdk',
      init: `import paaq "github.com/paaq/go-sdk"\n\npaaq.Initialize(paaq.Config{ SDKToken: "${t}", ProjectID: "${p}" })`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your Go project folder and run:',
          code: 'go get github.com/paaq/go-sdk',
        },
        {
          title: 'Step 2 — Initialize in main.go',
          note: 'Open main.go and add PAAQ initialization at the start of main():',
          code: `import paaq "github.com/paaq/go-sdk"\n\npaaq.Initialize(paaq.Config{\n    SDKToken:  "${t}",\n    ProjectID: "${p}",\n})`,
        },
      ],
    }
    case 'java': return {
      cmd: `<dependency>\n  <groupId>ai.paaq</groupId>\n  <artifactId>paaq-java-sdk</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
      init: `import ai.paaq.PAAQ;\n\nPAAQ.initialize(new PAAQConfig().sdkToken("${t}").projectId("${p}"));`,
      steps: [
        {
          title: 'Step 1 — Add PAAQ to pom.xml',
          note: 'Open pom.xml and paste this inside the <dependencies> block:',
          code: `<dependency>\n  <groupId>ai.paaq</groupId>\n  <artifactId>paaq-java-sdk</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
        },
        {
          title: 'Step 2 — Initialize in your Application class',
          note: 'Add this to your main Application class or Spring Boot startup:',
          code: `import ai.paaq.PAAQ;\n\nPAAQ.initialize(new PAAQConfig()\n  .sdkToken("${t}")\n  .projectId("${p}"));`,
        },
      ],
    }
    case 'dotnet': return {
      cmd: 'dotnet add package PAAQ.ServerSDK',
      init: `using PAAQ;\n\nbuilder.Services.AddPAAQ(o => { o.SDKToken = "${t}"; o.ProjectId = "${p}"; });\napp.UsePAAQ();`,
      steps: [
        {
          title: 'Step 1 — Install PAAQ',
          note: 'Open Terminal in your .NET project folder and run:',
          code: 'dotnet add package PAAQ.ServerSDK',
        },
        {
          title: 'Step 2 — Register in Program.cs',
          note: 'Open Program.cs and add PAAQ to your service registration — your credentials are already filled in:',
          code: `using PAAQ;\n\nbuilder.Services.AddPAAQ(options => {\n    options.SDKToken = "${t}";\n    options.ProjectId = "${p}";\n});\napp.UsePAAQ();`,
        },
      ],
    }
    default: return {
      cmd: 'npm install @paaq/web-sdk',
      init: `PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });`,
      steps: [
        { title: 'Step 1 — Install', code: 'npm install @paaq/web-sdk' },
        { title: 'Step 2 — Initialize', code: `PAAQ.initialize({ sdkToken: '${t}', projectId: '${p}' });` },
      ],
    }
  }
}

// ─── Reusable UI components ───────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, loading, loadingLabel = 'Working…', children, className = '' }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; loadingLabel?: string; children: React.ReactNode; className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading}
      style={{ background: TEAL_GRADIENT }}
      className={`flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingLabel}</> : children}
    </button>
  )
}

function SecondaryButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ borderColor: C.borderStrong, color: C.textSecondary }}
      className="flex h-12 items-center justify-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold transition-colors hover:bg-slate-50">
      {children}
    </button>
  )
}

function FieldLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <label className="mb-2 flex items-center gap-1 text-sm font-semibold" style={{ color: C.textPrimary }}>
      {children}
      {required && <span style={{ color: C.teal }}>*</span>}
      {optional && <span className="text-xs font-normal" style={{ color: C.textMuted }}>(optional)</span>}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, onEnter, ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void; ariaLabel?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value} aria-label={ariaLabel} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
      style={{
        borderColor: focused ? C.teal : C.border,
        boxShadow: focused ? `0 0 0 3px ${C.tealSoft}` : 'none',
      }}
      className="h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400"
    />
  )
}

function SelectDropdown({ value, onChange, options, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string; ariaLabel?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <select value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        borderColor: focused ? C.teal : C.border,
        boxShadow: focused ? `0 0 0 3px ${C.tealSoft}` : 'none',
        color: value ? C.textPrimary : C.textPlaceholder,
      }}
      className="h-12 w-full appearance-none rounded-xl border bg-white px-4 text-sm outline-none transition-all">
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o} value={o} style={{ color: C.textPrimary }}>{o}</option>)}
    </select>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy}
      style={{ borderColor: C.borderStrong, color: copied ? C.green : C.textSecondary }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-50">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function Rule() {
  return <hr className="border-0 border-t" style={{ borderColor: C.border }} />
}

function LabeledDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="h-px flex-1" style={{ background: C.border }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>{children}</span>
      <span className="h-px flex-1" style={{ background: C.border }} />
    </div>
  )
}

function StepFooter({ onBack, onNext, nextLabel, nextDisabled, loading, loadingLabel }: {
  onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean; loading?: boolean; loadingLabel?: string
}) {
  return (
    <div className="flex gap-3">
      {onBack && (
        <SecondaryButton onClick={onBack}>
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back
        </SecondaryButton>
      )}
      <PrimaryButton onClick={onNext} disabled={nextDisabled} loading={loading} loadingLabel={loadingLabel} className="flex-1">
        {nextLabel}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </PrimaryButton>
    </div>
  )
}

function StepShell({ icon, iconTone = 'teal', iconSize = 'md', title, subtitle, children }: {
  icon: React.ReactNode; iconTone?: 'teal' | 'green'; iconSize?: 'md' | 'lg'; title: string; subtitle: React.ReactNode; children: React.ReactNode
}) {
  const box = iconSize === 'lg' ? 'h-16 w-16' : 'h-14 w-14'
  const tone = iconTone === 'green'
    ? { background: C.greenSoft, color: C.green, border: `1px solid rgba(22,163,74,0.25)` }
    : { background: C.tealSoft, color: C.teal, border: `1px solid rgba(39,166,206,0.25)` }
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-5 flex ${box} items-center justify-center rounded-2xl`} style={tone}>{icon}</div>
        <h1 className={`${iconSize === 'lg' ? 'text-3xl' : 'text-2xl'} font-black tracking-tight`} style={{ color: C.textPrimary }}>
          {title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: C.textSecondary }}>{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const PROGRESS_STEPS = ['Org', 'Product', 'Keys', 'Done']

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-auto mb-10 flex max-w-md items-start">
      {PROGRESS_STEPS.map((label, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        const isLast = i === PROGRESS_STEPS.length - 1
        return [
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={isDone
                ? { background: C.green, color: '#fff' }
                : isActive
                  ? { background: TEAL_GRADIENT, color: '#fff', boxShadow: `0 0 0 4px ${C.tealSoft}` }
                  : { background: 'rgba(15,27,42,0.05)', color: C.textMuted }
              }>
              {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span className="hidden text-[9px] font-semibold uppercase tracking-wide sm:block sm:text-[10px]"
              style={{ color: isActive ? C.textPrimary : C.textMuted }}>
              {label}
            </span>
          </div>,
          !isLast && (
            <div key={`line-${label}`} className="mt-3.5 h-px flex-1"
              style={{ background: stepNum < currentStep ? C.green : C.border }} />
          ),
        ]
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [org, setOrg] = useState<OrgData>({ company: '', industry: '', country: '', website: '', teamSize: '' })
  const [product, setProduct] = useState<ProductData>({ projectName: '', productType: '', technology: '', environment: 'production' })
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const createProject = async () => {
    if (!product.projectName.trim() || !product.technology) return
    setSubmitting(true)
    setError(null)
    try {
      const sb = createClient()
      const { data: { session }, error: sessionErr } = await sb.auth.getSession()
      if (sessionErr || !session) { router.push('/login?next=/onboarding'); return }

      const techOption = ALL_TECH.find((t) => t.label === product.technology)
      const platformId = techOption?.platformId ?? 'other'

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/client-onboard`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyName:   org.company.trim(),
            industry:      org.industry || null,
            country:       org.country || null,
            website:       org.website || null,
            teamSize:      org.teamSize || null,
            workspaceName: `${org.company.trim() || 'My'} Workspace`,
            projectName:   product.projectName.trim(),
            platform:      platformId,
            environment:   product.environment,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      setCredentials({
        projectId:     data.project.project_id_key,
        sdkToken:      data.tokens.sdkToken,
        publicKey:     data.tokens.publicKey,
        secretKey:     data.tokens.secretKey,
        webhookSecret: data.tokens.webhookSecret,
      })
      setScreen('sdk')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepNumber = screen === 'org' ? 1 : screen === 'product' ? 2 : screen === 'sdk' ? 3 : screen === 'done' ? 4 : null

  const screenLabel: Record<Screen, string> = {
    welcome: '', org: 'Organisation', product: 'Connect Product', sdk: 'SDK Setup', done: 'Done',
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.textPrimary }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 h-14 w-full border-b backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: C.border }}>
        <div className="mx-auto flex h-full max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="PAAQ Intelligence" width={32} height={32} className="rounded-lg shadow-sm" />
            <span className="text-sm font-bold" style={{ color: C.textPrimary }}>PAAQ Intelligence</span>
          </div>
          {screen !== 'welcome' && (
            <span className="text-xs font-medium" style={{ color: C.textMuted }}>
              Setup · {screenLabel[screen]}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {stepNumber !== null && <ProgressBar currentStep={stepNumber} />}

        {/* ── Welcome ────────────────────────────────────────────────────── */}
        {screen === 'welcome' && (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <Image src="/logo.png" alt="PAAQ Intelligence" width={64} height={64} className="mb-6 rounded-2xl" />
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: C.textPrimary }}>
                Welcome to PAAQ Intelligence
              </h1>
              <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: C.textSecondary }}>
                AI that listens to your digital product and tells you what's happening — and why.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { n: '01', title: 'Set up your org',                  body: 'Add your company details to create your PAAQ account.' },
                { n: '02', title: 'Connect your digital product',      body: 'Pick your stack and grab the right SDK in seconds.' },
                { n: '03', title: 'Start getting AI insights in minutes', body: 'Agents begin analysing your product right away.' },
              ].map((b) => (
                <div key={b.n} className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.teal }}>{b.n}</div>
                  <div className="mt-2 text-sm font-bold" style={{ color: C.textPrimary }}>{b.title}</div>
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.textMuted }}>{b.body}</p>
                </div>
              ))}
            </div>

            <PrimaryButton onClick={() => setScreen('org')} className="w-full">
              Get started <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <p className="text-center text-xs" style={{ color: C.textMuted }}>
              Takes about 3 minutes · No credit card needed
            </p>
          </div>
        )}

        {/* ── Organisation ───────────────────────────────────────────────── */}
        {screen === 'org' && (
          <StepShell
            icon={<Building2 className="h-6 w-6" />}
            title="Tell us about your organisation"
            subtitle="This sets up your PAAQ account. You can update it later.">
            <Rule />
            <div>
              <FieldLabel required>Organisation / Company name</FieldLabel>
              <TextInput
                value={org.company} onChange={(v) => setOrg({ ...org, company: v })}
                placeholder="Acme Corp" ariaLabel="Company name"
                onEnter={() => org.company.trim() && setScreen('product')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Industry</FieldLabel>
                <SelectDropdown value={org.industry} onChange={(v) => setOrg({ ...org, industry: v })} options={INDUSTRIES} placeholder="Select industry…" ariaLabel="Industry" />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <SelectDropdown value={org.country} onChange={(v) => setOrg({ ...org, country: v })} options={COUNTRIES} placeholder="Select country…" ariaLabel="Country" />
              </div>
            </div>
            <div>
              <FieldLabel optional>Website</FieldLabel>
              <TextInput value={org.website} onChange={(v) => setOrg({ ...org, website: v })} placeholder="https://acme.com" ariaLabel="Website" />
            </div>
            <div>
              <FieldLabel optional>Team size</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {TEAM_SIZES.map((size) => {
                  const active = org.teamSize === size
                  return (
                    <button key={size} type="button" onClick={() => setOrg({ ...org, teamSize: active ? '' : size })}
                      style={{ borderColor: active ? C.teal : C.border, background: active ? C.tealSoft : '#fff', color: active ? C.textPrimary : C.textMuted }}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors">
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
            <Rule />
            <StepFooter onBack={() => setScreen('welcome')} onNext={() => setScreen('product')} nextLabel="Continue" nextDisabled={!org.company.trim()} />
          </StepShell>
        )}

        {/* ── Connect Product ─────────────────────────────────────────────── */}
        {screen === 'product' && (
          <StepShell
            icon={<Globe className="h-6 w-6" />}
            title="Connect your digital product"
            subtitle="Tell us what you're connecting — we'll give you the right SDK.">
            <Rule />
            <div>
              <FieldLabel required>Project name</FieldLabel>
              <TextInput value={product.projectName} onChange={(v) => setProduct({ ...product, projectName: v })} placeholder="My Digital Product" ariaLabel="Project name" />
            </div>

            <div>
              <FieldLabel required>What are you connecting?</FieldLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PRODUCT_TYPES.map((pt) => {
                  const active = product.productType === pt.id
                  const Icon = pt.Icon
                  return (
                    <button key={pt.id} type="button"
                      onClick={() => setProduct({ ...product, productType: pt.id, technology: '' })}
                      aria-pressed={active}
                      style={{
                        borderColor: active ? C.teal : C.border,
                        background: active ? 'rgba(39,166,206,0.055)' : '#fff',
                        boxShadow: active ? '0 8px 20px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)',
                      }}
                      className="group relative flex min-h-[108px] items-start gap-4 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all hover:border-slate-300 hover:shadow-md">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
                        style={{ background: active ? '#e4f8fb' : '#f4f7fa', color: active ? C.teal : C.textSecondary }}>
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 pr-5">
                        <span className="block text-sm font-bold" style={{ color: C.textPrimary }}>{pt.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed" style={{ color: C.textMuted }}>{pt.desc}</span>
                      </span>
                      {active && (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: C.teal }}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {product.productType && (
              <div>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <FieldLabel required>Choose your primary technology</FieldLabel>
                  <span className="mb-2 hidden text-xs sm:block" style={{ color: C.textMuted }}>You can add more later</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(TECH[product.productType] ?? []).map((tech) => {
                    const active = product.technology === tech.label
                    const Icon = tech.Icon
                    return (
                      <button key={tech.label} type="button"
                        onClick={() => setProduct({ ...product, technology: tech.label })}
                        aria-pressed={active}
                        style={{
                          borderColor: active ? C.teal : C.border,
                          background: active ? 'rgba(39,166,206,0.055)' : '#fff',
                          boxShadow: active ? '0 8px 18px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)',
                        }}
                        className="group relative flex min-h-[112px] flex-col items-center justify-center rounded-2xl border p-4 transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
                        <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 transition-colors group-hover:bg-slate-100">
                          <Icon className="h-6 w-6" style={{ color: tech.color }} />
                        </span>
                        <span className="text-xs font-semibold" style={{ color: active ? C.textPrimary : C.textSecondary }}>
                          {tech.label}
                        </span>
                        {active && (
                          <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: C.teal }}>
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <FieldLabel>Environment</FieldLabel>
              <div className="flex gap-3">
                {(['production', 'staging'] as const).map((env) => {
                  const active = product.environment === env
                  return (
                    <button key={env} type="button" onClick={() => setProduct({ ...product, environment: env })}
                      style={{ borderColor: active ? C.teal : C.border, background: active ? C.tealSoft : '#fff', color: active ? C.textPrimary : C.textMuted }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-all">
                      <span className="h-2 w-2 rounded-full" style={{ background: env === 'production' ? C.green : C.yellow }} />
                      {env}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" role="alert"
                style={{ background: C.redSoft, borderColor: 'rgba(220,38,38,0.3)', color: C.red }}>
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Rule />
            <StepFooter
              onBack={() => setScreen('org')}
              onNext={createProject}
              nextLabel="Create project"
              nextDisabled={!product.projectName.trim() || !product.productType || !product.technology}
              loading={submitting}
              loadingLabel="Creating…"
            />
          </StepShell>
        )}

        {/* ── SDK Setup (credentials + install guide) ─────────────────────── */}
        {screen === 'sdk' && credentials && (
          <SdkSetupScreen product={product} credentials={credentials} onBack={() => setScreen('product')} onNext={() => setScreen('done')} />
        )}

        {/* ── Done ────────────────────────────────────────────────────────── */}
        {screen === 'done' && (
          <StepShell
            icon={<CheckCircle2 className="h-8 w-8" />}
            iconTone="green" iconSize="lg"
            title="You're all set!"
            subtitle={
              <>
                <strong style={{ color: C.textPrimary }}>{product.projectName || 'Your project'}</strong>{' '}
                is connected to PAAQ Intelligence. AI agents are already getting to work.
              </>
            }>
            <Rule />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { Icon: BarChart3, title: 'Dashboard',   desc: 'Overview of your product health & KPIs' },
                { Icon: Activity,  title: 'Live Events', desc: 'Real-time stream of events and sessions' },
                { Icon: Sparkles,  title: 'AI Insights', desc: 'AI-generated patterns and recommendations' },
                { Icon: Flame,     title: 'Incidents',   desc: 'Auto-detected issues and root causes' },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: C.tealSoft, color: C.teal }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold" style={{ color: C.textPrimary }}>{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: C.textMuted }}>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <Rule />
            <PrimaryButton onClick={() => { router.push('/dashboard'); router.refresh() }} className="w-full">
              <CheckCircle2 className="h-4 w-4" /> Open my dashboard
            </PrimaryButton>
            <p className="text-center text-xs" style={{ color: C.textMuted }}>
              Your credentials and install guide are always available in Settings → SDK Setup.
            </p>
          </StepShell>
        )}
      </div>
    </div>
  )
}

// ─── SDK Setup screen ─────────────────────────────────────────────────────────

function SdkSetupScreen({ product, credentials, onBack, onNext }: {
  product: ProductData; credentials: Credentials; onBack: () => void; onNext: () => void
}) {
  const techOption = ALL_TECH.find((t) => t.label === product.technology)
  const { cmd, init, steps } = installSnippet(techOption?.platformId ?? 'other', credentials.sdkToken, credentials.projectId)
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'connected' | 'timeout'>('idle')

  const checkConnection = async () => {
    setCheckState('checking')
    const sb = createClient()
    const deadline = Date.now() + 30_000
    const poll = async (): Promise<void> => {
      if (Date.now() >= deadline) { setCheckState('timeout'); return }
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await sb
        .from('sdk_installations')
        .select('id')
        .eq('project_id', credentials.projectId)
        .gte('last_seen', cutoff)
        .limit(1)
      if (data && data.length > 0) { setCheckState('connected') }
      else { setTimeout(poll, 3000) }
    }
    poll()
  }

  const rows = [
    { label: 'Project ID',      value: credentials.projectId,     hint: 'Use in SDK initialization',          secret: false },
    { label: 'SDK Token',       value: credentials.sdkToken,      hint: 'Safe to bundle in your app',         secret: false },
    { label: 'Public Key',      value: credentials.publicKey,     hint: 'Safe for client-side reads',         secret: false },
    { label: 'Secret Key',      value: credentials.secretKey,     hint: 'Server-side only — never expose',    secret: true },
    { label: 'Webhook Secret',  value: credentials.webhookSecret, hint: 'Verify incoming webhooks',           secret: true },
  ]

  const copyAll = rows.map((r) => `${r.label}: ${r.value}`).join('\n')

  const downloadTxt = () => {
    const content = rows.map((r) => `${r.label}: ${r.value}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${product.projectName || 'paaq'}-credentials.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <StepShell
      icon={<Key className="h-6 w-6" />}
      iconTone="green"
      title="Your credentials are ready"
      subtitle={
        <>
          Save these now — Secret Key and Webhook Secret are shown{' '}
          <strong style={{ color: C.textPrimary }}>once only</strong>.
        </>
      }>

      {/* Credential table */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: C.border }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(15,27,42,0.02)', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div className="text-sm font-bold" style={{ color: C.textPrimary }}>{product.projectName || 'Untitled project'}</div>
            <div className="text-xs capitalize" style={{ color: C.textMuted }}>{product.technology} · {product.environment}</div>
          </div>
          <CopyButton text={copyAll} label="Copy all" />
        </div>
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-start gap-3 px-4 py-3"
            style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: C.textPrimary }}>{r.label}</span>
                {r.secret && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: 'rgba(202,138,4,0.12)', color: C.yellow }}>
                    Server only
                  </span>
                )}
              </div>
              <div className="mt-1 break-all font-mono text-xs" style={{ color: C.textSecondary }}>{r.value}</div>
              <div className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>{r.hint}</div>
            </div>
            <CopyButton text={r.value} />
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{ background: 'rgba(202,138,4,0.06)', borderColor: 'rgba(202,138,4,0.25)', color: C.yellow }}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Store Secret Key and Webhook Secret in environment variables. They cannot be recovered if lost — only rotated.</span>
      </div>

      <LabeledDivider>Install the SDK</LabeledDivider>

      {steps && steps.length > 0 ? (
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="rounded-2xl border p-4" style={{ borderColor: C.border, background: '#fff' }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>{step.title}</span>
                {step.code && <CopyButton text={step.code} />}
              </div>
              {step.note && (
                <p className="mb-2 text-xs leading-relaxed" style={{ color: C.textMuted }}>{step.note}</p>
              )}
              {step.code && (
                <div className="overflow-x-auto rounded-xl border p-3 font-mono text-xs leading-relaxed whitespace-pre"
                  style={{ borderColor: C.border, background: '#f8fafc', color: C.teal }}>
                  {step.code}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>1. Install package</span>
              <CopyButton text={cmd} />
            </div>
            <div className="overflow-x-auto rounded-xl border p-4 font-mono text-xs"
              style={{ borderColor: C.border, background: '#f8fafc', color: C.teal }}>
              {cmd}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>2. Initialise with your credentials</span>
              <CopyButton text={init} label="Copy code" />
            </div>
            <pre className="overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed"
              style={{ background: '#0d1117', color: '#86efac' }}>
              {init}
            </pre>
          </div>
        </>
      )}

      {/* Connection verification */}
      <div className="rounded-2xl border p-4" style={{ borderColor: C.border, background: 'rgba(39,166,206,0.03)' }}>
        <div className="mb-1 text-sm font-semibold" style={{ color: C.textPrimary }}>Test your connection</div>
        <p className="mb-3 text-xs leading-relaxed" style={{ color: C.textMuted }}>
          After adding the SDK to your app and running it at least once, click the button below.
          We&apos;ll check if PAAQ has received a signal from your app — it only takes a few seconds.
        </p>

        {checkState === 'idle' && (
          <button type="button" onClick={checkConnection}
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-sm"
            style={{ borderColor: C.teal, color: C.teal, background: C.tealSoft }}>
            <Activity className="h-4 w-4" />
            Verify connection
          </button>
        )}

        {checkState === 'checking' && (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.teal }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Listening for your app… (checking every 3 seconds)
          </div>
        )}

        {checkState === 'connected' && (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.green }}>
            <CheckCircle2 className="h-4 w-4" />
            Connected! PAAQ is receiving data from your app.
          </div>
        )}

        {checkState === 'timeout' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#dc2626' }}>
              <X className="h-4 w-4" />
              No signal detected yet.
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.textMuted }}>
              Make sure you&apos;ve added the code, saved the file, and run the app. Then try again.
            </p>
            <button type="button" onClick={checkConnection}
              className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold"
              style={{ borderColor: C.border, color: C.textSecondary }}>
              <Activity className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}
      </div>

      <Rule />

      <div className="flex gap-3">
        <SecondaryButton onClick={downloadTxt}>
          <Download className="h-4 w-4" /> Download .txt
        </SecondaryButton>
        <PrimaryButton onClick={checkState === 'connected' ? onNext : onNext} className="flex-1">
          {checkState === 'connected' ? (
            <><CheckCircle2 className="h-4 w-4" /> Continue to dashboard</>
          ) : (
            <>I&apos;ll add the SDK later <ArrowRight className="h-4 w-4" /></>
          )}
        </PrimaryButton>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={onBack}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: C.textMuted }}>
          Back to product setup
        </button>
      </div>
    </StepShell>
  )
}
