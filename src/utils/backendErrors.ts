// Structured errors from backend responses: the message plus the debugging details the backend
// sends for failed renders (exception type, location in the backend code, traceback, plot log).

export interface BackendErrorDetails {
  message: string
  errorType?: string
  location?: string
  traceback?: string
  log?: string
  messages: string[]
  status?: number
}

export class BackendError extends Error {
  readonly details: BackendErrorDetails

  constructor(details: BackendErrorDetails) {
    super(details.message)
    this.name = 'BackendError'
    this.details = details
  }
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

// Returned by the Vite dev proxy (and most reverse proxies) when the backend is down.
const PROXY_ERROR_STATUSES = new Set([502, 503, 504])

/** Reads a failed backend response into a BackendError. */
export async function readBackendError(
  response: Response,
  messages: { fallback: string; unreachable: string },
): Promise<BackendError> {
  const raw = await response.text().catch(() => '')
  let payload: Record<string, unknown> | null = null
  try {
    const parsed: unknown = JSON.parse(raw)
    payload = parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    payload = null
  }

  if (!payload && PROXY_ERROR_STATUSES.has(response.status)) {
    return new BackendError({ message: messages.unreachable, messages: [], status: response.status })
  }

  return new BackendError({
    message: text(payload?.message) ?? (raw.trim().slice(0, 500) || messages.fallback),
    errorType: text(payload?.error_type),
    location: text(payload?.location),
    traceback: text(payload?.traceback),
    log: text(payload?.log),
    messages: Array.isArray(payload?.messages) ? payload.messages.filter((entry): entry is string => typeof entry === 'string') : [],
    status: response.status,
  })
}

export type FetchBackendOptions = {
  unreachable: string
  /** Aborts the request after this many milliseconds and throws a BackendError with `timedOut`. */
  timeoutMs?: number
  timedOut?: string
}

/**
 * fetch() that reports an unreachable server as a BackendError instead of a bare TypeError and
 * gives up after `timeoutMs`, so a request can never wait forever without a message.
 */
export async function fetchBackend(input: string, init: RequestInit, options: FetchBackendOptions): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = options.timeoutMs === undefined ? undefined : setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs)
  const abortFromCaller = () => controller.abort()
  init.signal?.addEventListener('abort', abortFromCaller)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) throw new BackendError({ message: options.timedOut ?? options.unreachable, messages: [] })
    throw new BackendError({ message: options.unreachable, messages: [], log: error instanceof Error ? `${error.name}: ${error.message}` : String(error) })
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abortFromCaller)
  }
}

/** Any thrown value as error details (frontend errors keep their stack for the log). */
export function toErrorDetails(error: unknown, fallback: string): BackendErrorDetails {
  if (error instanceof BackendError) return error.details
  if (error instanceof Error) return { message: error.message, errorType: error.name, traceback: error.stack, messages: [] }
  return { message: fallback, messages: [] }
}
