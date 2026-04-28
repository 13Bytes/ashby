import { useEffect, useState } from 'react'
import { toExternalConfig } from '../utils/configIo'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { Alert } from './ui/alert'
import { Button } from './ui/button'

interface Props {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  activeFrameIndex: number
  plotAction: 'preview-current' | 'create-all'
  plotActionNonce: number
}
interface RenderedPlotEntry {
  dataframeIndex: number
  frameIndex: number
  url: string
  blob: Blob
  mediaType: string
  exportFileName?: string
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

export function PlotPage({ plotConfig, activeDataframeIndex, activeFrameIndex, plotAction, plotActionNonce }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [createdPlots, setCreatedPlots] = useState<RenderedPlotEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)

  const getDownloadName = (entry: RenderedPlotEntry) => {
    const extension = entry.mediaType.includes('png') ? 'png' : 'svg'
    const base = entry.exportFileName?.trim() || `ashby-df${entry.dataframeIndex + 1}-frame${entry.frameIndex + 1}`
    return `${base}.${extension}`
  }

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
        const exportFileName = plotConfig.dataframes[dataframeIndex]?.frames[frameIndex]?.exportFileName
        return [...rest, { dataframeIndex, frameIndex, url: nextUrl, blob: imageBlob, mediaType: imageBlob.type, exportFileName }]
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

    const total = dataframeSelection.reduce((count, dataframeIndex) => {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) return count
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      return count + frameSelection.length
    }, 0)
    setBatchProgress({ current: 0, total })
    let completed = 0
    for (const dataframeIndex of dataframeSelection) {
      const dataframe = plotConfig.dataframes[dataframeIndex]
      if (!dataframe) continue
      const frameSelection = dataframe.createAllFrames === true ? dataframe.frames.map((_, index) => index) : dataframe.createAllFrames
      for (const frameIndex of frameSelection) {
        try {
          await fetchPlot(dataframeIndex, frameIndex)
        } catch {
          // errors are shown via alert state
        } finally {
          completed += 1
          setBatchProgress({ current: completed, total })
        }
      }
    }
    setBatchProgress(null)
  }



  const downloadSinglePlot = (entry: RenderedPlotEntry) => {
    const anchor = document.createElement('a')
    anchor.href = entry.url
    anchor.download = getDownloadName(entry)
    anchor.click()
  }
  const downloadAllCreatedPlots = async () => {
    const response = await fetch('/api/download-plots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: toExternalConfig(plotConfig),
        plots: createdPlots.map((entry) => ({ dataframe_index: entry.dataframeIndex, frame_index: entry.frameIndex })),
      }),
    })
    if (!response.ok) {
      setError(`Download all failed (${response.status}).`)
      return
    }
    const zipBlob = await response.blob()
    const zipUrl = URL.createObjectURL(zipBlob)
    const anchor = document.createElement('a')
    anchor.href = zipUrl
    anchor.download = 'ashby-plots.zip'
    anchor.click()
    URL.revokeObjectURL(zipUrl)
  }

  useEffect(() => {
    void fetchPlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataframeIndex, activeFrameIndex])

  useEffect(() => {
    if (plotAction === 'create-all') {
      void createPlots()
      return
    }
    void fetchPlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotActionNonce])

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

  const createdPlotsSorted = [...createdPlots].sort((a, b) =>
    a.dataframeIndex === b.dataframeIndex ? a.frameIndex - b.frameIndex : a.dataframeIndex - b.dataframeIndex,
  )

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-left">
      <section className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-transparent">
        <div>
          <h3 className="m-0 text-sm font-semibold">Backend plot preview</h3>
          <p className="m-0 mt-1 text-xs text-zinc-500">The selected dataframe/frame config is rendered by the Python backend.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void fetchPlot()} disabled={loading} title="Refresh preview">
            ↻
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadAllCreatedPlots()} disabled={createdPlots.length === 0}>
            Download all (.zip)
          </Button>
        </div>
      </section>
      {batchProgress ? <p className="m-0 text-xs text-zinc-500">{`${batchProgress.current} of ${batchProgress.total} Plots created`}</p> : null}

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
        {imageUrl ? <img src={imageUrl} alt="Rendered Ashby plot" className="block h-auto max-w-full" /> : null}
        {createdPlotsSorted.length > 0 ? (
          <div className="mt-6 grid gap-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {createdPlotsSorted.map((entry) => (
              <article key={`${entry.dataframeIndex}-${entry.frameIndex}`} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="m-0 text-xs font-semibold text-zinc-500">{`Dataframe ${entry.dataframeIndex + 1} · Frame ${entry.frameIndex + 1}`}</h4>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    onClick={() => downloadSinglePlot(entry)}
                    title="Download this plot"
                  >
                    ⬇️ this
                  </button>
                </div>
                <img src={entry.url} alt={`Rendered dataframe ${entry.dataframeIndex + 1} frame ${entry.frameIndex + 1}`} className="block h-auto max-w-full" />
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
