import { MessageCircle, Calendar, Users, BookOpen, type LucideIcon } from 'lucide-react'

export type Module = 'ask' | 'book' | 'attend' | 'learn'

export type ModuleDef = {
  id: Module
  label: string
  desc: string
  Icon: LucideIcon
  colorClass: string
  bgClass: string
  softClass: string
  borderClass: string
  ringClass: string
  patterns: RegExp[]
}

export const MODULES: ModuleDef[] = [
  {
    id: 'ask',
    label: 'Ask',
    desc: 'Q&A · Expert Answers · Credibility',
    Icon: MessageCircle,
    colorClass: 'text-ask',
    bgClass: 'bg-ask',
    softClass: 'bg-ask/12 text-ask border-ask/25',
    borderClass: 'border-ask',
    ringClass: 'ring-ask/30',
    patterns: [/ask|question|q.?a|answer|credib|expert|service/i],
  },
  {
    id: 'book',
    label: 'Book',
    desc: 'Sessions · Advisory · Agora',
    Icon: Calendar,
    colorClass: 'text-book',
    bgClass: 'bg-book',
    softClass: 'bg-book/12 text-book border-book/25',
    borderClass: 'border-book',
    ringClass: 'ring-book/30',
    patterns: [/book|session|advisor|schedule|slot|advisory|booking|escrow|agora|note.?tak/i],
  },
  {
    id: 'attend',
    label: 'Attend',
    desc: 'Events · Ticketing · Live Q&A',
    Icon: Users,
    colorClass: 'text-attend',
    bgClass: 'bg-attend',
    softClass: 'bg-attend/12 text-attend border-attend/25',
    borderClass: 'border-attend',
    ringClass: 'ring-attend/30',
    patterns: [/attend|event|conference|webinar|ticket|live|speak|sponsor|moderator|qr|access.?code/i],
  },
  {
    id: 'learn',
    label: 'Learn',
    desc: 'Courses · Masterclasses · Enrolment',
    Icon: BookOpen,
    colorClass: 'text-learn',
    bgClass: 'bg-learn',
    softClass: 'bg-learn/12 text-learn border-learn/25',
    borderClass: 'border-learn',
    ringClass: 'ring-learn/30',
    patterns: [/learn|course|masterclass|lesson|class|module|teach|enroll/i],
  },
]

export function detectModule(screenName: string | null, category: string | null): Module | null {
  const text = [screenName, category].filter(Boolean).join(' ')
  for (const m of MODULES) {
    if (m.patterns.some((p) => p.test(text))) return m.id
  }
  return null
}

export function getModule(id: Module): ModuleDef {
  return MODULES.find((m) => m.id === id)!
}
