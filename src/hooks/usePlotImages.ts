import { useCallback, useEffect, useRef, useState } from 'react'
import type { DataframeConfig, FrameConfig } from '../config/defaultPlotConfig'

/** The last image of a plot and the settings it was rendered with (`key`). */
export type PlotImage = { key: string; blob?: Blob; url?: string; messages?: string[]; error?: string }

/** Identifies a plot across moves and renames. */
export const plotId = (dataframe: DataframeConfig, frame: FrameConfig) => `${String(dataframe._extensions.uiKey)}/${String(frame._extensions.uiKey)}`

/**
 * Everything a plot's image depends on: its dataframe's settings except the other plots, its own
 * settings, the data file and whether the attribution key is entered (see apply_attribution).
 */
export const renderKey = (dataframe: DataframeConfig, frame: FrameConfig, file: File | undefined, unlocked: boolean) =>
  // JSON leaves out the undefined entries: the other plots and which plots "Generate all" includes
  JSON.stringify([unlocked, file ? [file.name, file.size, file.lastModified] : null, { ...dataframe, frames: undefined, createAllFrames: undefined }, frame])

/**
 * The last image of every plot, shared by the preview and the list of all plots: a plot that is
 * selected or deselected keeps its image instead of being rendered again. The image of a removed
 * plot is kept too, so undoing the removal brings it back; all are released when the page goes.
 */
export function usePlotImages() {
  const [images, setImages] = useState<Record<string, PlotImage>>({})
  const storeImage = useCallback((id: string, key: string, result: { blob: Blob; messages?: string[] } | { error: string }) => {
    if ('blob' in result) {
      const url = URL.createObjectURL(result.blob)
      setImages((current) => {
        if (current[id]?.url && current[id].url !== url) URL.revokeObjectURL(current[id].url)
        return { ...current, [id]: { key, blob: result.blob, url, messages: result.messages } }
      })
    } else {
      // the last image stays, with the error below it, until the settings change again
      setImages((current) => ({ ...current, [id]: { ...current[id], key, error: result.error } }))
    }
  }, [])

  const imagesRef = useRef(images)
  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => () => { Object.values(imagesRef.current).forEach((image) => { if (image.url) URL.revokeObjectURL(image.url) }) }, [])

  return { images, storeImage }
}
