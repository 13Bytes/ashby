import { useSyncExternalStore } from 'react'

/**
 * Plots rendered on the server carry an attribution instead of the copyright notice, and no
 * watermark (ATTRIBUTION_TEXT in backend/security.py). The attribution key (ASHBY_ATTRIBUTION_KEY on
 * the server) unlocks switching both on or off. The backend decides; the editor only shows the switches.
 */
export const ATTRIBUTION_KEY_HEADER = 'X-Ashby-Attribution-Key'
/**
 * Kept in this browser until "Lock" (or until the server no longer accepts it, see App), never in the
 * config. Anyone using this browser profile can therefore render without the attribution.
 */
const STORAGE_KEY = 'ashby-attribution-key'

const listeners = new Set<() => void>()

export function readAttributionKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Stores a key the server accepted, or forgets it (null). */
export function setAttributionKey(key: string | null): void {
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the key is simply not kept.
  }
  listeners.forEach((listener) => listener())
}

// Locking or unlocking in another tab of this browser applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) listeners.forEach((listener) => listener())
  })
}

/** Header for render requests: sent only while a key is stored. */
export const attributionHeaders = (key: string | null = readAttributionKey()): Record<string, string> =>
  key ? { [ATTRIBUTION_KEY_HEADER]: key } : {}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True while this session holds a key the server accepted. */
export function useAttributionUnlocked(): boolean {
  return useSyncExternalStore(subscribe, () => readAttributionKey() !== null, () => false)
}

/** Asks the server whether the key unlocks the switches. Throws when the server cannot be reached. */
export async function checkAttributionKey(key: string): Promise<boolean> {
  const response = await fetch('/api/attribution-key', { method: 'POST', headers: attributionHeaders(key), cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result: unknown = await response.json()
  return typeof result === 'object' && result !== null && (result as { valid?: unknown }).valid === true
}
