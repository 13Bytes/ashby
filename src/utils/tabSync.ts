// Live config sync between browser tabs of the same "workspace".
//
// Each tab keeps its config in sessionStorage. A tab opened from another one (middle click on a
// tab, window.open) gets a copy of that sessionStorage, including the workspace id, so both tabs
// join the same workspace and stay in sync. Unrelated tabs get their own id and stay independent.
//
// The workspace id is also in the URL. A tab that starts without sessionStorage but with that URL
// (a duplicated tab in browsers that do not copy sessionStorage, e.g. LibreWolf) joins the
// workspace and asks the other tabs for the current config.

const WORKSPACE_STORAGE_KEY = 'ashby-workspace-id'
const CHANNEL_NAME = 'ashby-config-sync'

export const WORKSPACE_URL_PARAM = 'workspace'
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

/** `config` carries a config; `request` asks the other tabs of the workspace to send theirs. */
type SyncMessage =
  | { kind?: 'config'; workspaceId: string; senderId: string; config: string }
  | { kind: 'request'; workspaceId: string; senderId: string }

type ChannelLike = Pick<BroadcastChannel, 'postMessage' | 'close'> & {
  onmessage: ((event: MessageEvent<SyncMessage>) => void) | null
}

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Workspace id from a URL query string, if it has a valid one. */
export function getUrlWorkspaceId(search: string): string | null {
  const value = new URLSearchParams(search).get(WORKSPACE_URL_PARAM)
  return value && WORKSPACE_ID_PATTERN.test(value) ? value : null
}

/** The workspace of this tab: from sessionStorage, else from the URL, else a new one. */
export function getWorkspaceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.sessionStorage,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): string {
  try {
    const existing = storage.getItem(WORKSPACE_STORAGE_KEY)
    if (existing) return existing
    const created = getUrlWorkspaceId(search) ?? randomId()
    storage.setItem(WORKSPACE_STORAGE_KEY, created)
    return created
  } catch {
    // Without sessionStorage there is nothing to share with other tabs anyway.
    return randomId()
  }
}

export type ConfigSync = {
  /** Sends a serialized config to the other tabs of this workspace. */
  publish: (config: string) => void
  /** Asks the other tabs of this workspace for their config; answers arrive like published configs. */
  requestConfig: () => void
  close: () => void
}

/**
 * Connects this tab to the other tabs of its workspace. `getCurrentConfig` answers config requests
 * of other tabs (e.g. a duplicated tab that starts empty).
 */
export function createConfigSync(
  onRemoteConfig: (config: string) => void,
  getCurrentConfig: () => string | null,
  workspaceId: string = getWorkspaceId(),
  createChannel: () => ChannelLike | null = () => (typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)),
): ConfigSync {
  const channel = createChannel()
  const senderId = randomId()
  if (!channel) {
    return { publish: () => {}, requestConfig: () => {}, close: () => {} }
  }
  const publish = (config: string) => channel.postMessage({ kind: 'config', workspaceId, senderId, config } satisfies SyncMessage)

  channel.onmessage = (event) => {
    const message = event.data
    if (!message || message.workspaceId !== workspaceId || message.senderId === senderId) return
    if (message.kind === 'request') {
      const current = getCurrentConfig()
      if (current !== null) publish(current)
      return
    }
    if (typeof message.config === 'string') onRemoteConfig(message.config)
  }

  return {
    publish,
    requestConfig: () => channel.postMessage({ kind: 'request', workspaceId, senderId } satisfies SyncMessage),
    close: () => channel.close(),
  }
}
