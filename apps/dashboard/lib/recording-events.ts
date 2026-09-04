import type { eventWithTime } from 'rrweb'

/** Merge chunk arrays from session-recording-url into one ordered event stream. */
export function mergeRecordingEvents(chunkArrays: unknown[][]): eventWithTime[] {
  const events = chunkArrays.flat() as eventWithTime[]
  events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  return events
}

/** Default rrweb-player props for smooth, faithful playback (no time-skipping). */
export function replayPlayerProps(events: eventWithTime[], width: number, height = 500) {
  return {
    events,
    width,
    height,
    autoPlay: false,
    speed: 1,
    skipInactive: false,
    showWarning: false,
    mouseTail: {
      duration: 800,
      lineCap: 'round',
      lineWidth: 2,
      strokeStyle: '#e75a3c',
    },
  }
}
