# PAAQ Intelligence — Onboarding Flow Design Spec

> Hand this to the designer. Every screen, every state, every component is described below.
> Once designs are approved, the developer codes directly from this document.

---

## Overview

| Property | Value |
|---|---|
| Total steps | 5 screens (Welcome + 4 numbered steps) |
| Theme | Dark — background `#060b10`, text `#e8f0f8`, accent `#51C9D3` |
| Max content width | `640px` centered |
| Font | Geist Sans (already in project) |
| Breakpoints | Mobile-first. Desktop ≥ 768px |

---

## Global Layout (all screens)

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, frosted glass)                                  │
│  [● PAAQ Intelligence logo]              [Setup · Step Name]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    PROGRESS BAR (steps 1–4 only)                │
│          ①────②────③────④                                      │
│        Org   Product  Keys  Done                                │
│                                                                 │
│                    STEP CONTENT (centered, max-w-xl)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Header
- Height: `56px`
- Background: `rgba(10,16,24,0.85)` with `backdrop-filter: blur(16px)`
- Bottom border: `rgba(255,255,255,0.06)`
- Left: Logo icon (teal gradient square 32×32, sparkle icon inside) + wordmark "PAAQ Intelligence" bold
- Right: `"Setup · {Current Step Name}"` in muted text `#4a5568`, `12px`

### Progress Indicator (steps 1–4 only, hidden on Welcome and Done)
- 4 numbered circles connected by lines
- Circle: `28px` diameter
- **Done** state: filled green `#22c55e`, white checkmark icon
- **Active** state: teal gradient fill `linear-gradient(135deg, #27A6CE, #51C9D3)`, white number, soft glow ring
- **Pending** state: `rgba(255,255,255,0.06)` fill, `#4a5568` number
- Connector line: `1px` height, green when step is done, `rgba(255,255,255,0.08)` when pending
- Step label below each circle: `9px`, semibold, white when active, `#4a5568` when pending/done
- Labels: `Org` / `Product` / `Keys` / `Done`

---

## Screen 0 — Welcome

**Purpose:** First impression. Sell the value. Single CTA.

```
┌─────────────────────────────────────────────────────────────────┐
│                         [HEADER — no step counter]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                  ┌──────────────────────┐                       │
│                  │  ✦  (sparkle icon)   │  ← 64×64 rounded-2xl │
│                  │  teal glow border    │    teal/10 bg         │
│                  └──────────────────────┘                       │
│                                                                 │
│              Welcome to PAAQ Intelligence                       │
│              ─── 32px, font-black, centered ───                 │
│                                                                 │
│        AI that listens to your digital product                  │
│         and tells you what's happening — and why.               │
│              ─── 16px, #8ba0b4, centered ───                    │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  01             │  │  02             │  │  03             │  │
│  │  Set up         │  │  Connect your   │  │  Start getting  │  │
│  │  your org       │  │  digital        │  │  AI insights    │  │
│  │                 │  │  product        │  │  in minutes     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│   3-col grid on desktop, stacked on mobile                      │
│   Card: rounded-2xl, border rgba(255,255,255,0.08), dark bg     │
│   Number: 10px, teal, uppercase, tracking-widest                │
│   Title: 14px, bold, white                                      │
│   Body: 12px, #5a7085, leading-relaxed                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            Get started   →                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ← full width, teal gradient, 14px bold, rounded-xl, h-14       │
│                                                                 │
│         Takes about 3 minutes · No credit card needed           │
│         ─── 12px, #4a5568, centered ───                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**States:** None — static screen.

---

## Screen 1 — Your Organisation  *(Step 1 of 4)*

**Purpose:** Collect company info. Workspace is auto-created silently — user never sees it.

```
┌─────────────────────────────────────────────────────────────────┐
│  [HEADER]          [PROGRESS: ①●──②──③──④]                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ┌──────────────┐                                   │
│              │  🏢  icon    │  ← 56×56 rounded-2xl, teal/10 bg │
│              └──────────────┘                                   │
│                                                                 │
│           Tell us about your organisation                       │
│           ─── 24px, font-black, centered ───                    │
│                                                                 │
│     This sets up your PAAQ account. You can update it later.   │
│           ─── 14px, #8ba0b4, centered ───                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Organisation / Company name  *                                 │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  Acme Corp                                            │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← h-12, rounded-xl, border rgba(255,255,255,0.1)               │
│     focus border: rgba(81,201,211,0.5)                          │
│                                                                 │
│  Industry                          Country                      │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Select industry… ▾  │  │ Select country…  ▾  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│  ← 2-col grid on desktop, stacked on mobile                     │
│                                                                 │
│  Website  (optional)                                            │
│  ┌──── 🌐 ───────────────────────────────────────────────┐      │
│  │  https://acme.com                                     │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← globe icon inside input on left                              │
│                                                                 │
│  Team size  (optional)                                          │
│  [ Just me ]  [ 2–10 ]  [ 11–50 ]  [ 51–200 ]  [ 200+ ]        │
│  ← horizontal pill toggles, single select                       │
│     inactive: border rgba(255,255,255,0.1), #5a7085 text        │
│     active: teal border + teal/10 bg, white text                │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  ← Back      │    │   Continue   →                      │    │
│  └──────────────┘    └─────────────────────────────────────┘    │
│  ← Back: bordered, muted            Continue: teal gradient     │
│     Disabled if Company Name is empty                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**States:**
- `Continue` button disabled until company name has at least 1 character
- Enter key on company name field advances to next step
- All fields except company name are optional

---

## Screen 2 — Connect Your Digital Product  *(Step 2 of 4)*

**Purpose:** Choose what they're connecting + tech stack. This triggers the DB write when they click "Create project".

```
┌─────────────────────────────────────────────────────────────────┐
│  [HEADER]          [PROGRESS: ①✓──②●──③──④]                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ┌──────────────┐                                   │
│              │  🌐  icon    │  ← 56×56 rounded-2xl, teal/10 bg │
│              └──────────────┘                                   │
│                                                                 │
│              Connect your digital product                       │
│           ─── 24px, font-black, centered ───                    │
│                                                                 │
│       Tell us what you're connecting — we'll give               │
│                    you the right SDK.                           │
│           ─── 14px, #8ba0b4, centered ───                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Project name  *                                                │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  My Digital Product                                   │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                 │
│  What are you connecting?  *                                    │
│  ┌───────────────────────────┐  ┌───────────────────────────┐   │
│  │  🌐                       │  │  📱                       │   │
│  │  Website                  │  │  Mobile App               │   │
│  │  React, Next.js, Vue…    │  │  Flutter, React Native…   │   │
│  └───────────────────────────┘  └───────────────────────────┘   │
│  ┌───────────────────────────┐  ┌───────────────────────────┐   │
│  │  ⚙️                       │  │  🏗️                       │   │
│  │  Backend API              │  │  Full Platform            │   │
│  │  Node.js, Python, Go…    │  │  Web · Mobile · Backend   │   │
│  └───────────────────────────┘  └───────────────────────────┘   │
│  ← 2×2 grid                                                     │
│     Each card: rounded-xl, border-2                             │
│     Unselected: border rgba(255,255,255,0.08), dark bg          │
│     Selected: border #51C9D3, rgba(81,201,211,0.08) bg          │
│     Icon: 20px emoji, top-left                                  │
│     Label: 12px bold, white when selected, #8ba0b4 unselected   │
│     Desc: 10px, #4a5568                                         │
│                                                                 │
│  Technology  *  ← only appears after product type is selected   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │  ⚛️  │ │  ▲  │ │  💚  │ │  🔺  │ │  🟨  │                  │
│  │React │ │Next │ │ Vue  │ │Ang.. │ │Vanil │                  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
│  ← 3-col or 4-col grid (5 items for website)                    │
│     Each: flex-col, centered, rounded-xl, border-2              │
│     Emoji: 24px                                                 │
│     Label: 11px semibold                                        │
│     Same selected/unselected states as above                    │
│                                                                 │
│  Environment                                                    │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ ● Production          │  │ ○ Staging             │            │
│  └──────────────────────┘  └──────────────────────┘            │
│  ← full-width toggle pair                                       │
│     Green dot = production, yellow dot = staging                │
│     Active: teal border + teal/8 bg                             │
│                                                                 │
│  ─ ERROR (if DB write fails) ────────────────────────────────   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  ✕  Failed to create organisation: [error message]    │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← red/8 bg, red/30 border, #fca5a5 text                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  ← Back      │    │  ⟳ Creating…  /  Create project →   │    │
│  └──────────────┘    └─────────────────────────────────────┘    │
│  ← Disabled until: project name filled + type selected +        │
│     technology selected                                         │
│     Loading state: spinner icon + "Creating…" text             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What happens on "Create project":**
1. Creates organisation (tenant) if user doesn't have one
2. Adds user as admin member
3. Auto-creates workspace `"{CompanyName} Workspace"` silently
4. Creates project with selected platform + environment
5. Generates 4 credentials (SDK Token, Public Key, Secret Key, Webhook Secret)
6. Advances to Screen 3

**Technology options per product type:**

| Website | Mobile App | Backend API | Full Platform |
|---|---|---|---|
| ⚛️ React | 🦋 Flutter | 🟢 Node.js | All of the above |
| ▲ Next.js | 📱 React Native | 🐍 Python | (show all 14) |
| 💚 Vue | 🍎 iOS | 🔵 Go | |
| 🔺 Angular | 🤖 Android | ☕ Java | |
| 🟨 Vanilla JS | | 💜 .NET | |

---

## Screen 3 — SDK Setup  *(Step 3 of 4)*

**Purpose:** Show credentials + install guide in one screen. Combined from what was previously 2 separate steps.

```
┌─────────────────────────────────────────────────────────────────┐
│  [HEADER]          [PROGRESS: ①✓──②✓──③●──④]                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ┌──────────────┐                                   │
│              │  🔑  icon    │  ← 56×56, green/10 bg            │
│              └──────────────┘                                   │
│                                                                 │
│                Your credentials are ready                       │
│           ─── 24px, font-black, centered ───                    │
│                                                                 │
│         Save these now — Secret Key and Webhook Secret          │
│                   are shown  once only.                         │
│           "once only" in bold white                             │
│                                                                 │
│  ─── CREDENTIAL TABLE ────────────────────────────────────      │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  {Project Name}                          [Copy all]   │      │
│  │  {platform} · {environment}                           │      │
│  │  ─────────────────────────────────────────────────    │      │
│  │  Project ID       proj_ab12cd34ef56    [Copy]         │      │
│  │  SDK Token        sdk_live_•••••       [Copy]         │      │
│  │  Public Key       pk_live_•••••        [Copy]         │      │
│  │  Secret Key       sk_live_•••••        [Copy]  🔒     │      │
│  │  Webhook Secret   whsec_•••••          [Copy]  🔒     │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← rounded-2xl, border rgba(255,255,255,0.08)                   │
│     Header row: rgba(255,255,255,0.02) bg                       │
│     Each row: border-b rgba(255,255,255,0.05)                   │
│     Label: 12px bold, white                                     │
│     Value: 12px mono, #5a7085                                   │
│     Hint below value: 10px, #4a5568                             │
│     🔒 badge: yellow/15 bg, "Server only" label                 │
│     [Copy] button: small, bordered, on right                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  ⚠  Store Secret Key and Webhook Secret in env vars.  │      │
│  │     They cannot be recovered if lost — only rotated.  │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← yellow/6 bg, yellow/25 border, #ca8a04 text                  │
│                                                                 │
│  ─── DIVIDER ─────────────────────────────────────────────      │
│                      Install the SDK                            │
│  ─── thin line either side of text, #4a5568 ──────────────      │
│                                                                 │
│  1. Install package                            [Copy]           │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  npm install @paaq/web-sdk                            │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← teal text, code font, dark border                            │
│                                                                 │
│  2. Initialise with your credentials           [Copy code]      │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  import { PAAQProvider } from '@paaq/web-sdk';        │      │
│  │                                                       │      │
│  │  export default function App() {                      │      │
│  │    return (                                           │      │
│  │      <PAAQProvider                                    │      │
│  │        sdkToken="sdk_live_..."                        │      │
│  │        projectId="proj_..."                           │      │
│  │      >                                                │      │
│  │        <YourApp />                                    │      │
│  │      </PAAQProvider>                                  │      │
│  │    );                                                 │      │
│  │  }                                                    │      │
│  └───────────────────────────────────────────────────────┘      │
│  ← #0d1117 bg, #86efac (green) text, code font, scrollable     │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────────────────┐     │
│  │ ↓ Download .txt    │  │  I've added the SDK  →         │     │
│  └────────────────────┘  └────────────────────────────────┘     │
│  ← Download: bordered, muted, left-aligned                      │
│     Primary: teal gradient, right-aligned, flex-1               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Credential hints:**

| Field | Hint text |
|---|---|
| Project ID | Use in SDK initialization |
| SDK Token | Safe to bundle in your app |
| Public Key | Safe for client-side reads |
| Secret Key | Server-side only — never expose |
| Webhook Secret | Verify incoming webhooks |

---

## Screen 4 — You're All Set  *(Step 4 of 4)*

**Purpose:** Celebration + orient the user towards the dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│  [HEADER]          [PROGRESS: ①✓──②✓──③✓──④●]                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ┌──────────────┐                                   │
│              │  ✅  icon    │  ← 64×64, green/12 bg            │
│              │   (larger)   │    green/20 border                │
│              └──────────────┘                                   │
│                                                                 │
│                      You're all set!                            │
│              ─── 32px, font-black, centered ───                 │
│                                                                 │
│         {Project Name} is connected to PAAQ Intelligence.       │
│               AI agents are already getting to work.            │
│           ─── 14px, #8ba0b4, centered, {Name} in white ───      │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐     │
│  │  📊  Dashboard           │  │  ⚡  Live Events           │     │
│  │  Overview of your        │  │  Real-time stream of      │     │
│  │  product health & KPIs   │  │  events and sessions      │     │
│  └──────────────────────────┘  └──────────────────────────┘     │
│  ┌──────────────────────────┐  ┌──────────────────────────┐     │
│  │  ✦  AI Insights          │  │  🔴  Incidents            │     │
│  │  AI-generated patterns   │  │  Auto-detected issues     │     │
│  │  and recommendations     │  │  and root causes          │     │
│  └──────────────────────────┘  └──────────────────────────┘     │
│  ← 2×2 grid                                                     │
│     Each card: flex-row, icon on left (teal/10 bg, 36×36 sq)    │
│     Icon: 16px, teal color                                      │
│     Title: 14px bold, white                                     │
│     Desc: 12px, #5a7085                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ✅  Open my dashboard  →                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ← teal gradient, full width, 14px bold, h-14                   │
│                                                                 │
│      Your credentials and install guide are always available    │
│                    in Settings → SDK Setup.                     │
│           ─── 12px, #4a5568, centered ───                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Library (for this flow only)

### PrimaryButton
```
Background:  linear-gradient(135deg, #27A6CE, #51C9D3)
Text:        white, 14px, bold
Height:      h-14 (56px)
Radius:      rounded-xl
Width:       flex-1 or full-width
Hover:       opacity 0.9
Disabled:    opacity 0.4, not-allowed cursor
Loading:     spinner icon replaces label
```

### SecondaryButton (Back / Download)
```
Background:  transparent
Border:      1px rgba(255,255,255,0.12)
Text:        #8ba0b4, 14px, semibold
Height:      h-12 (48px)
Padding:     px-5
Hover:       bg rgba(255,255,255,0.05)
```

### TextInput
```
Background:  rgba(255,255,255,0.04)
Border:      1px rgba(255,255,255,0.1)
Focus border: rgba(81,201,211,0.5)
Text:        #e8f0f8, 14px
Radius:      rounded-xl
Height:      h-12 (48px)
Padding:     px-4
Placeholder: #4a5568
```

### SelectDropdown
```
Same as TextInput
Background for native select: rgba(10,16,24,0.9)
Arrow:       system default (or custom chevron)
Empty value: #4a5568 colour
```

### Card (info / feature card)
```
Background:  rgba(255,255,255,0.02)
Border:      1px rgba(255,255,255,0.08)
Radius:      rounded-2xl
Padding:     p-6
```

### PillToggle (team size selector)
```
Unselected:  border rgba(255,255,255,0.1), bg transparent, text #5a7085
Selected:    border #51C9D3, bg rgba(81,201,211,0.08), text #e8f0f8
Radius:      rounded-xl
Padding:     px-4 py-2
Font:        14px semibold
Gap between: 8px
```

### ProductTypeCard (2×2 grid)
```
Unselected:  border-2 rgba(255,255,255,0.08), bg rgba(255,255,255,0.02)
Selected:    border-2 #51C9D3, bg rgba(81,201,211,0.08)
Radius:      rounded-xl
Padding:     px-4 py-3
Layout:      flex-row, icon left (20px emoji, mt-0.5), text right
Icon/Label gap: 12px
Label:       12px bold
Desc:        10px, #4a5568
Hover:       scale(1.01)
Transition:  all 150ms
```

### TechCard (3-col grid)
```
Unselected:  border-2 rgba(255,255,255,0.08), bg rgba(255,255,255,0.02)
Selected:    border-2 #51C9D3, bg rgba(81,201,211,0.08)
Radius:      rounded-xl
Padding:     px-3 py-4
Layout:      flex-col, centered
Emoji:       24px
Label:       11px semibold, white when selected, #5a7085 unselected
Hover:       scale(1.02)
```

### EnvironmentToggle
```
Layout:      2 equal buttons, flex-row, gap-3
Each:        flex-1, flex-row centered, gap-2, rounded-xl border-2 py-3
             14px semibold capitalize
Dot:         h-2 w-2 rounded-full (green for prod, yellow for staging)
Active:      border #51C9D3, bg rgba(81,201,211,0.08), text white
Inactive:    border rgba(255,255,255,0.08), text #5a7085
```

### CredentialRow
```
Layout:      flex-row, items-start, gap-3, border-b, px-4 py-3
Label:       12px bold, #e8f0f8
Badge:       9px uppercase bold, rounded px-1.5 py-0.5
             "Server only": yellow/15 bg, #eab308 text
Value:       12px mono, #5a7085, break-all
Hint:        10px, #4a5568, mt-0.5
CopyButton:  right-aligned, shrink-0
```

### CopyButton
```
Border:      rgba(255,255,255,0.12)
Text:        #8ba0b4, 12px semibold
Padding:     px-3 py-1.5
Radius:      rounded-lg
Hover:       bg rgba(255,255,255,0.05)
Copied state: green check icon, "Copied!" text, 2s then reverts
```

### CodeBlock
```
Radius:      rounded-xl overflow-hidden
Header bar:  bg rgba(255,255,255,0.03), border-b rgba(255,255,255,0.06)
             label on left (12px, #4a5568), CopyButton on right
             padding: px-4 py-2.5
Code area:   bg #0d1117, text #86efac (green), 12px mono
             p-4, overflow-x-auto, leading-relaxed
Install cmd: teal text #51C9D3 instead of green
```

### ErrorBanner
```
Background:  rgba(239,68,68,0.06)
Border:      rgba(239,68,68,0.3)
Text:        #fca5a5, 14px
Radius:      rounded-xl
Padding:     px-4 py-3
Layout:      flex-row, X icon left (h-4 w-4), message right
```

### WarningBanner
```
Background:  rgba(234,179,8,0.06)
Border:      rgba(234,179,8,0.25)
Text:        #ca8a04, 12px leading-relaxed
Radius:      rounded-xl
Padding:     px-4 py-3
Layout:      flex-row, AlertTriangle icon left, message right
```

---

## Colours Reference

| Token | Hex | Usage |
|---|---|---|
| Background | `#060b10` | Full page bg |
| Surface | `rgba(255,255,255,0.02)` | Cards |
| Border | `rgba(255,255,255,0.08)` | Default borders |
| Border focus | `rgba(81,201,211,0.5)` | Input focus |
| Text primary | `#e8f0f8` | Headings, labels |
| Text secondary | `#8ba0b4` | Subheadings |
| Text muted | `#5a7085` | Descriptions |
| Text placeholder | `#4a5568` | Input placeholders |
| Accent teal | `#51C9D3` | Brand colour, borders |
| Accent gradient | `#27A6CE → #51C9D3` | Buttons, active states |
| Success green | `#22c55e` | Done circles, done states |
| Warning yellow | `#eab308` | Secret key badges |
| Error red | `#fca5a5` | Error messages |
| Code green | `#86efac` | Code snippet text |
| Code bg | `#0d1117` | Code block background |

---

## Spacing & Layout

| Property | Value |
|---|---|
| Page padding | `px-6 py-10` |
| Content max-width | `max-w-2xl` (672px) |
| Section gap | `space-y-6` (24px) |
| Field gap | `space-y-4` (16px) |
| Button row gap | `gap-3` (12px) |
| Card inner padding | `p-6` (24px) |

---

## Interactions & Micro-animations

| Trigger | Behaviour |
|---|---|
| Product type card selected | Technology grid slides in below with fade-in |
| Platform card selected | Border + bg transition 150ms |
| Copy button clicked | Icon swaps to check, "Copied!" text, reverts after 2s |
| "Create project" clicked | Spinner replaces button label, button disabled |
| DB error | Red banner appears above button with error message |
| Step advance | Scroll to top of content area |

---

## Mobile Adaptations

| Element | Desktop | Mobile |
|---|---|---|
| 3-col benefit cards (Welcome) | 3 columns | 1 column stacked |
| Industry + Country (Step 1) | 2 columns | 1 column stacked |
| Product type grid (Step 2) | 2×2 | 2×2 (same) |
| Tech grid (Step 2) | 3 columns | 3 columns (smaller) |
| Progress step labels | Visible | Hidden (numbers only) |
| Credential table value | Full mono | Truncated + scroll |
| Done cards grid | 2×2 | 1 column stacked |

---

## What Was Removed vs Old Design

| Old (8 steps) | New (5 screens) | Reason |
|---|---|---|
| Step 2 — Workspace | Auto-created silently | User friction, no value |
| Step 5 — Install (separate) | Merged into Step 3 | Unnecessary split |
| Step 6 — Verify | Removed | Fake verification, no real value |
| Step 7 — Done | Became Screen 4 | Combined with done state |
| 8 cramped progress dots | 4 clean circles | Less cognitive load |
| Team size dropdown | Pill toggles | Easier to scan and tap |

---

*Spec version 1.0 — PAAQ Intelligence Onboarding — 2026-07-23*
