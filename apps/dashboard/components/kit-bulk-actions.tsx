'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'

export function useBulkSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clear = () => setSelected(new Set())
  const isSelected = (id: string) => selected.has(id)

  return { selected, toggle, clear, isSelected, count: selected.size }
}

export function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={onChange}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-border/60 accent-foreground"
      aria-label="Select row"
    />
  )
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  itemLabel = 'item',
  onDeleteSelected,
  onClearAll,
  onDeselectAll,
}: {
  selectedCount: number
  totalCount: number
  itemLabel?: string
  onDeleteSelected: () => void
  onClearAll: () => void
  onDeselectAll: () => void
}) {
  if (totalCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      {selectedCount > 0 ? (
        <>
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          <button
            onClick={onDeleteSelected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-critical/30 bg-critical/10 px-2.5 py-1 text-xs font-medium text-critical hover:bg-critical/20"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete selected
          </button>
          <button
            onClick={onDeselectAll}
            title="Clear selection"
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          {totalCount} {itemLabel}{totalCount === 1 ? '' : 's'}
        </span>
      )}
      <button
        onClick={onClearAll}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-critical/30 hover:bg-critical/10 hover:text-critical"
      >
        <Trash2 className="h-3.5 w-3.5" /> Clear all
      </button>
    </div>
  )
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border/70 bg-card/60 px-4 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-critical px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
