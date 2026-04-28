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
interface RenderedPlotEntry {
  dataframeIndex: number
  frameIndex: number
  url: string
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
  const [createdPlots, setCreatedPlots] = useState<RenderedPlotEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<string[]>([])

  const fetchPlot = async (dataframeIndex = activeDataframeIndex, frameIndex = activeFrameIndex): Promise<string> => {
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
          dataframe_index: dataframeIndex,
          frame_index: frameIndex,
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
      if (dataframeIndex === activeDataframeIndex && frameIndex === activeFrameIndex) {
        setImageUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current)
          }
          return nextUrl
        })
      }
      setCreatedPlots((current) => {
        const existing = current.find((entry) => entry.dataframeIndex === dataframeIndex && entry.frameIndex === frameIndex)
        if (existing) {
          URL.revokeObjectURL(existing.url)
        }
        const rest = current.filter((entry) => !(entry.dataframeIndex === dataframeIndex && entry.frameIndex === frameIndex))
        return [...rest, { dataframeIndex, frameIndex, url: nextUrl }]
      })
      return nextUrl
    } catch (renderError) {
      setImageUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return null
      })
      setError(renderError instanceof Error ? renderError.message : 'Failed to render plot.')
      throw renderError
    } finally {
      setLoading(false)
    }
  }

  const createPlots = async () => {
    const dataframeSelection =
      plotConfig.createAllDataframes === true
        ? plotConfig.dataframes.map((_, index) => index)
        : plotConfig.createAllDataframes

    for (const dataframeIndex of dataframeSelection) {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) continue
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      for (const frameIndex of frameSelection) {
        try {
          await fetchPlot(dataframeIndex, frameIndex)
        } catch {
          // errors are shown via alert state
        }
      }
    }
  }

  const downloadAllCreatedPlots = () => {
    createdPlots.forEach((entry) => {
      const anchor = document.createElement('a')
      anchor.href = entry.url
      anchor.download = `ashby-df${entry.dataframeIndex + 1}-frame${entry.frameIndex + 1}.svg`
      anchor.click()
    })
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

  useEffect(
    () => () => {
      createdPlots.forEach((entry) => URL.revokeObjectURL(entry.url))
    },
    [createdPlots],
  )

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
        <Button type="button" variant="outline" onClick={() => void createPlots()} disabled={loading}>
          {loading ? 'Rendering…' : 'Create plots'}
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
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={downloadAllCreatedPlots}
            disabled={createdPlots.length === 0}
            title="Download created plots"
          >
            ⬇️
          </button>
        </div>
        {loading && !imageUrl ? <p className="text-sm text-zinc-500">Rendering image from backend…</p> : null}
        {imageUrl ? <img src={imageUrl} alt="Rendered Ashby plot" className="block min-w-fit max-w-none" /> : null}
      </section>
    </main>
  )
}
