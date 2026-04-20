import { useEffect, useState } from 'react'
import { toExternalConfig } from '../utils/configIo'
import type { PlotConfig } from '../config/defaultPlotConfig'
import { Alert } from './ui/alert'
import { Button } from './ui/button'

interface Props {
  plotConfig: PlotConfig
}

export function PlotPage({ plotConfig }: Props) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlot = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/render-plot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: toExternalConfig(plotConfig) }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message || `Plot render failed (${response.status}).`)
      }

      const payload = (await response.json()) as { svg?: string; message?: string }
      if (!payload.svg) {
        throw new Error(payload.message || 'Backend did not return an SVG.')
      }

      setSvgMarkup(payload.svg)
    } catch (renderError) {
      setSvgMarkup(null)
      setError(renderError instanceof Error ? renderError.message : 'Failed to render plot.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotConfig])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-left">
      <section className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h3 className="m-0 text-sm font-semibold">Backend plot preview</h3>
          <p className="m-0 mt-1 text-xs text-zinc-500">The complete JSON config is sent to the Python backend.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void fetchPlot()} disabled={loading}>
          {loading ? 'Rendering…' : 'Preview plot'}
        </Button>
      </section>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <section className="min-h-[55vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {loading && !svgMarkup ? <p className="text-sm text-zinc-500">Rendering SVG from backend…</p> : null}
        {svgMarkup ? <div className="min-w-fit" dangerouslySetInnerHTML={{ __html: svgMarkup }} /> : null}
      </section>
    </main>
  )
}
