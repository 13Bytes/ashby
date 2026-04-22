import { useEffect, useState } from 'react'
import { toExternalConfig } from '../utils/configIo'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { Alert } from './ui/alert'
import { Button } from './ui/button'

interface Props {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  activeFrameIndex: number
}

function parseBackendMessages(headerValue: string | null): string[] {
  if (!headerValue) {
    return []
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(headerValue)) as unknown
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  } catch {
    return []
  }
}

export function PlotPage({ plotConfig, activeDataframeIndex, activeFrameIndex }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<string[]>([])

  const fetchPlot = async () => {
    setLoading(true)
    setError(null)
    setMessages([])

    try {
      const response = await fetch('/api/render-plot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: toExternalConfig(plotConfig),
          dataframe_index: activeDataframeIndex,
          frame_index: activeFrameIndex,
        }),
      })
      const nextMessages = parseBackendMessages(response.headers.get('X-Ashby-Messages'))

      if (!response.ok) {
        const rawError = await response.text()
        let payload: { message?: string; messages?: string[] } = {}
        try {
          payload = JSON.parse(rawError) as { message?: string; messages?: string[] }
        } catch {
          payload = { message: rawError }
        }
        setMessages(Array.isArray(payload.messages) ? payload.messages : nextMessages)
        throw new Error(payload.message || `Plot render failed (${response.status}).`)
      }

      const imageBlob = await response.blob()
      if (imageBlob.size === 0) {
        throw new Error('Backend returned an empty image.')
      }
      setMessages(nextMessages)

      const nextUrl = URL.createObjectURL(imageBlob)
      setImageUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return nextUrl
      })
    } catch (renderError) {
      setImageUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return null
      })
      setError(renderError instanceof Error ? renderError.message : 'Failed to render plot.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotConfig, activeDataframeIndex, activeFrameIndex])

  useEffect(() => () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-left">
      <section className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h3 className="m-0 text-sm font-semibold">Backend plot preview</h3>
          <p className="m-0 mt-1 text-xs text-zinc-500">The selected dataframe/frame config is rendered by the Python backend.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void fetchPlot()} disabled={loading}>
          {loading ? 'Rendering…' : 'Preview plot'}
        </Button>
      </section>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {messages.length > 0 ? (
        <Alert>
          <div className="grid gap-1">
            <strong>Plot messages</strong>
            {messages.map((message) => (
              <p key={message} className="m-0">
                {message}
              </p>
            ))}
          </div>
        </Alert>
      ) : null}

      <section className="min-h-[55vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {loading && !imageUrl ? <p className="text-sm text-zinc-500">Rendering image from backend…</p> : null}
        {imageUrl ? <img src={imageUrl} alt="Rendered Ashby plot" className="block min-w-fit max-w-none" /> : null}
      </section>
    </main>
  )
}
