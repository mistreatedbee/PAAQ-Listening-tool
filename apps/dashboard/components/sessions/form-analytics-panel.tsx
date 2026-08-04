import { Card, CardHead, ToneBadge } from '@/components/kit'
import { ClipboardList } from 'lucide-react'

export type FormFieldStat = {
  id: string
  page_path: string
  form_name: string | null
  field_name: string
  time_spent_ms: number | null
  backspace_count: number
  had_error: boolean
  completed: boolean
}

function fmtDuration(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function FormAnalyticsPanel({ fields }: { fields: FormFieldStat[] }) {
  if (fields.length === 0) return null

  const byForm = fields.reduce<Record<string, FormFieldStat[]>>((acc, f) => {
    const key = f.form_name ?? f.page_path
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  return (
    <Card>
      <CardHead title="Form analytics" desc="Field-level friction captured for this session" icon={<ClipboardList className="h-4 w-4" />} />
      <div className="space-y-4 px-5 pb-5">
        {Object.entries(byForm).map(([formName, formFields]) => (
          <div key={formName}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formName}</p>
            <div className="space-y-1.5">
              {formFields.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{f.field_name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span>{fmtDuration(f.time_spent_ms)}</span>
                    {f.backspace_count > 0 && <span>{f.backspace_count} corrections</span>}
                    {f.had_error && <ToneBadge tone="critical">error</ToneBadge>}
                    <ToneBadge tone={f.completed ? 'healthy' : 'warning'}>{f.completed ? 'completed' : 'left blank'}</ToneBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
