import { useEffect, useMemo, useRef } from 'react'
import type { AxisConfig, DataframeConfig, FrameConfig, GuidelineConfig, PlotConfig } from '../config/defaultPlotConfig'
import { materialSamples, type MaterialSample } from '../data/materialSamples'
import { Alert } from './ui/alert'
import { Card } from './ui/card'

interface Props {
  plotConfig: PlotConfig
  activeDataframeIndex: number
  activeFrameIndex: number
}

type PlotTrace = {
  x: number[]
  y: number[]
  text: string[]
  customdata: string[][]
  mode: 'markers'
  type: 'scatter'
  name: string
  marker: {
    color: string
    opacity: number
    size: number
    line: {
      color: string
      width: number
    }
  }
  hovertemplate: string
}

const asNumber = (value: MaterialSample[string]): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const getAxisLabel = (axis: AxisConfig | undefined, language: string): string =>
  axis?.labels[language] || axis?.labels.en || axis?.name || ''

const getRecordNumber = (record: MaterialSample, column: string): number | null => {
  const candidates = [
    column,
    column.replace('18 MPa', '1.8 MPa'),
    `${column} low`,
    `${column} high`,
    `${column.replace('18 MPa', '1.8 MPa')} low`,
    `${column.replace('18 MPa', '1.8 MPa')} high`,
  ]

  for (const candidate of candidates) {
    const value = asNumber(record[candidate])
    if (value !== null) {
      return value
    }
  }

  return null
}

const getAxisValue = (record: MaterialSample, axis: AxisConfig | undefined): number | null => {
  if (!axis) {
    return null
  }

  const values = axis.columns
    .map((column) => getRecordNumber(record, column))
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return null
  }

  if (axis.mode === 'max' || axis.mode === 'span') {
    return Math.max(...values)
  }

  if (axis.mode === 'min') {
    return Math.min(...values)
  }

  return values[0]
}

const getRelativeValue = (record: MaterialSample, dataframe: DataframeConfig, quantity?: string): number | null => {
  if (!quantity) {
    return null
  }

  const axis = dataframe.axes.find((entry) => entry.name === quantity)
  return axis ? getAxisValue(record, axis) : getRecordNumber(record, quantity)
}

const passesLayerFilter = (record: MaterialSample, layer: FrameConfig['layers'][number]): boolean => {
  const field = layer.name || 'Material'
  const value = String(record[field] ?? '')
  const whitelist = layer.whitelist?.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) ?? []

  if (whitelist.length === 0) {
    return true
  }

  const hasMatch = whitelist.some((entry) => value.toLowerCase().includes(entry.toLowerCase()))
  return layer.whitelistFlag ? hasMatch : !hasMatch
}

const getColor = (dataframe: DataframeConfig, material: string): string =>
  dataframe.materialColors[material] || dataframe.materialColors.default || '#111827'

const getGuidelineShapes = (guidelines: GuidelineConfig[]) =>
  guidelines
    .map((guideline) => {
      if (guideline.x !== undefined) {
        return {
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: guideline.x,
          x1: guideline.x,
          y0: 0,
          y1: 1,
          line: {
            color: guideline.lineProps.color,
            width: guideline.lineProps.linewidth,
            dash: guideline.lineProps.linestyle === '--' ? 'dash' : 'solid',
          },
        }
      }

      if (guideline.y !== undefined) {
        return {
          type: 'line',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: guideline.y,
          y1: guideline.y,
          line: {
            color: guideline.lineProps.color,
            width: guideline.lineProps.linewidth,
            dash: guideline.lineProps.linestyle === '--' ? 'dash' : 'solid',
          },
        }
      }

      return null
    })
    .filter(Boolean)

function buildPlot(plotConfig: PlotConfig, activeDataframeIndex: number, activeFrameIndex: number) {
  const dataframe = plotConfig.dataframes[activeDataframeIndex] ?? plotConfig.dataframes[0]
  const frame = dataframe.frames[activeFrameIndex] ?? dataframe.frames[0]
  const xAxis = dataframe.axes.find((axis) => axis.name === frame.xQuantity)
  const yAxis = dataframe.axes.find((axis) => axis.name === frame.yQuantity)
  const dataLayer = frame.layers.find((layer) => layer.name) ?? frame.layers[0] ?? {}
  const styleLayer = frame.layers[frame.layers.length - 1] ?? {}
  const pointGroups = new Map<string, PlotTrace>()

  for (const record of materialSamples) {
    if (!passesLayerFilter(record, dataLayer)) {
      continue
    }

    const xBase = getAxisValue(record, xAxis)
    const yBase = getAxisValue(record, yAxis)
    const xRel = getRelativeValue(record, dataframe, frame.xRelQuantity)
    const yRel = getRelativeValue(record, dataframe, frame.yRelQuantity)
    const x = xBase !== null && xRel ? xBase / xRel : xBase
    const y = yBase !== null && yRel ? yBase / yRel : yBase

    if (x === null || y === null) {
      continue
    }

    const material = String(record.Material ?? 'Material')
    const trace =
      pointGroups.get(material) ??
      {
        x: [],
        y: [],
        text: [],
        customdata: [],
        mode: 'markers',
        type: 'scatter',
        name: material,
        marker: {
          color: getColor(dataframe, material),
          opacity: styleLayer.alphaPoints ?? dataLayer.alpha ?? 0.72,
          size: 11,
          line: {
            color: getColor(dataframe, material),
            width: dataLayer.linewidth ?? 1.5,
          },
        },
        hovertemplate:
          '<b>%{text}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>x: %{x}<br>y: %{y}<extra></extra>',
      }

    trace.x.push(x)
    trace.y.push(y)
    trace.text.push(String(record.Variante ?? material))
    trace.customdata.push([String(record.Hersteller ?? ''), String(record.Gruppe ?? '')])
    pointGroups.set(material, trace)
  }

  const darkMode = frame.darkMode || dataframe.darkMode
  const paperColor = darkMode ? '#18181b' : '#ffffff'
  const plotColor = darkMode ? '#09090b' : '#fafafa'
  const textColor = darkMode ? '#f4f4f5' : '#18181b'
  const gridColor = darkMode ? '#3f3f46' : '#e4e4e7'

  return {
    traces: [...pointGroups.values()],
    layout: {
      autosize: true,
      paper_bgcolor: paperColor,
      plot_bgcolor: plotColor,
      font: {
        family: dataframe.font.font,
        size: dataframe.font.fontSize,
        color: textColor,
      },
      title: {
        text: frame.title[dataframe.language] || frame.title.en || frame.name || 'Ashby plot',
      },
      xaxis: {
        title: getAxisLabel(xAxis, dataframe.language),
        type: frame.logXFlag ? 'log' : 'linear',
        range: frame.xLim ?? undefined,
        gridcolor: gridColor,
        zerolinecolor: gridColor,
      },
      yaxis: {
        title: getAxisLabel(yAxis, dataframe.language),
        type: frame.logYFlag ? 'log' : 'linear',
        range: frame.yLim ?? undefined,
        gridcolor: gridColor,
        zerolinecolor: gridColor,
      },
      legend: {
        orientation: frame.legendAbove ? 'h' : 'v',
        x: frame.legendAbove ? 0 : 1.02,
        y: frame.legendAbove ? 1.18 : 1,
        title: { text: dataframe.legendTitle[dataframe.language] || dataframe.legendTitle.en || dataLayer.name || 'Material' },
      },
      margin: { l: 88, r: frame.legendFlag ? 128 : 24, t: frame.legendAbove ? 108 : 64, b: 72 },
      showlegend: frame.legendFlag,
      shapes: getGuidelineShapes(frame.guidelines),
    },
  }
}

export function PlotPage({ plotConfig, activeDataframeIndex, activeFrameIndex }: Props) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const { traces, layout } = useMemo(
    () => buildPlot(plotConfig, activeDataframeIndex, activeFrameIndex),
    [plotConfig, activeDataframeIndex, activeFrameIndex],
  )

  useEffect(() => {
    const element = plotRef.current
    if (!element) {
      return
    }

    let cancelled = false
    let plotly: typeof import('plotly.js-dist-min').default | null = null

    import('plotly.js-dist-min').then((module) => {
      if (cancelled) {
        return
      }

      plotly = module.default
      plotly.react(element, traces, layout, { responsive: true, displaylogo: false })
    })

    const resize = () => plotly?.Plots.resize(element)
    window.addEventListener('resize', resize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', resize)
      plotly?.purge(element)
    }
  }, [layout, traces])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-left">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
        <Card>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Rows</span>
          <strong className="text-zinc-900 dark:text-zinc-100">{materialSamples.length}</strong>
        </Card>
        <Card>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Plotted</span>
          <strong className="text-zinc-900 dark:text-zinc-100">{traces.reduce((sum, trace) => sum + trace.x.length, 0)}</strong>
        </Card>
        <Card>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Groups</span>
          <strong className="text-zinc-900 dark:text-zinc-100">{traces.length}</strong>
        </Card>
      </div>

      {traces.length === 0 ? (
        <Alert variant="destructive">No rows match the active frame axes and layer filter.</Alert>
      ) : null}

      <section className="min-h-[620px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div ref={plotRef} className="h-[620px] w-full" />
      </section>
    </main>
  )
}
