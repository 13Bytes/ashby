import { useSyncExternalStore } from 'react'

// In-memory log of backend interactions (renders, imports, downloads) for debugging in the UI.
// Kept outside React state so every part of the app can write to it; lost on reload.

export type LogLevel = 'info' | 'warning' | 'error'
export type LogSource = 'render' | 'download' | 'import' | 'config'

export interface DebugLogEntry {
  id: number
  time: number
  level: LogLevel
  source: LogSource
  title: string
  message?: string
  location?: string
  messages?: string[]
  traceback?: string
  log?: string
  status?: number
  durationMs?: number
}

type LogState = { entries: DebugLogEntry[] }

const MAX_ENTRIES = 100
let nextId = 0
let state: LogState = { entries: [] }
const listeners = new Set<() => void>()

const setState = (next: LogState) => {
  state = next
  listeners.forEach((listener) => listener())
}

export function addLogEntry(entry: Omit<DebugLogEntry, 'id' | 'time'>): void {
  nextId += 1
  setState({ entries: [{ ...entry, id: nextId, time: Date.now() }, ...state.entries].slice(0, MAX_ENTRIES) })
}

export function clearLog(): void {
  setState({ entries: [] })
}

export const getLogState = (): LogState => state

export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDebugLog(): LogState {
  return useSyncExternalStore(subscribeLog, getLogState)
}

const pad = (value: number) => String(value).padStart(2, '0')
export const formatLogTime = (time: number): string => {
  const date = new Date(time)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Plain-text form of an entry, e.g. to paste into an issue. */
export function formatLogEntry(entry: DebugLogEntry): string {
  const lines = [`[${formatLogTime(entry.time)}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.title}`]
  if (entry.status !== undefined) lines.push(`HTTP status: ${entry.status}`)
  if (entry.durationMs !== undefined) lines.push(`Duration: ${entry.durationMs} ms`)
  if (entry.message) lines.push(`Message: ${entry.message}`)
  if (entry.location) lines.push(`Location: ${entry.location}`)
  if (entry.messages?.length) lines.push('Messages:', ...entry.messages.map((message) => `  - ${message}`))
  if (entry.traceback) lines.push('Traceback:', entry.traceback.trimEnd())
  if (entry.log) lines.push('Backend output:', entry.log.trimEnd())
  return lines.join('\n')
}
