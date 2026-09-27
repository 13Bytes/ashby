// Live config sync between browser tabs of the same "workspace".
//
// Each tab keeps its config in sessionStorage. A tab opened from another one (middle click on a
// tab, window.open) gets a copy of that sessionStorage, including the workspace id, so both tabs
// join the same workspace and stay in sync. Unrelated tabs get their own id and stay independent.

const WORKSPACE_STORAGE_KEY = 'ashby-workspace-id'
const CHANNEL_NAME = 'ashby-config-sync'

type SyncMessage = { workspaceId: string; senderId: string; config: string }

type ChannelLike = Pick<BroadcastChannel, 'postMessage' | 'close'> & {
  onmessage: ((event: MessageEvent<SyncMessage>) => void) | null
}

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function getWorkspaceId(storage: Pick<Storage, 'getItem' | 'setItem'> = window.sessionStorage): string {
  try {
    const existing = storage.getItem(WORKSPACE_STORAGE_KEY)
    if (existing) return existing
    const created = randomId()
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
  close: () => void
}

export function createConfigSync(
  onRemoteConfig: (config: string) => void,
  workspaceId: string = getWorkspaceId(),
  createChannel: () => ChannelLike | null = () => (typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)),
): ConfigSync {
  const channel = createChannel()
  const senderId = randomId()
  if (!channel) {
    return { publish: () => {}, close: () => {} }
  }

  channel.onmessage = (event) => {
    const message = event.data
    if (!message || message.workspaceId !== workspaceId || message.senderId === senderId) return
    if (typeof message.config === 'string') onRemoteConfig(message.config)
  }

  return {
    publish: (config) => channel.postMessage({ workspaceId, senderId, config } satisfies SyncMessage),
    close: () => channel.close(),
  }
}
