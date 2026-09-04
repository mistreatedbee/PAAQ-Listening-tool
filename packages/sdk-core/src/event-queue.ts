import type { EventPayload, PaaqConfig } from './types'
import { DEFAULT_PAAQ_CONFIG } from './constants'

export class EventQueue {
  private items: EventPayload[] = []
  private config: PaaqConfig = { ...DEFAULT_PAAQ_CONFIG }

  setConfig(config: PaaqConfig): void {
    this.config = config
  }

  get batchSize(): number {
    return this.config.batchSize
  }

  enqueue(event: Omit<EventPayload, 'timestamp'> & { timestamp?: string }): void {
    this.items.push({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    })
  }

  shouldFlush(): boolean {
    return this.items.length >= this.config.batchSize
  }

  /** Drain the queue and return the batch (empty if nothing queued). */
  drain(): EventPayload[] {
    if (this.items.length === 0) return []
    return this.items.splice(0)
  }

  get length(): number {
    return this.items.length
  }
}
