import type { Dispatch, SetStateAction } from 'react'
import type { AxisConfig, DataframeConfig, FrameConfig, GuidelineConfig, PlotConfig } from '../config/defaultPlotConfig'
import { addAxisToDataframe, addGuidelineToFrame, addLayerToFrame, generateMaterialColorsForDataframe, updateAxisInDataframe, updateGuidelineInFrame } from '../utils/configEditing'
import { getNextTabName, getSelectedIndices, nextDataframeName, insertSelectionIndex, moveItem, refreshUiKey, removeSelectionIndex, reorderSelectionIndices, toggleIndexSelection } from '../utils/appState'

type Params = {
  activeDataframeIndex: number
  activeFrameIndex: number
  setActiveDataframeIndex: Dispatch<SetStateAction<number>>
  setActiveFrameIndex: Dispatch<SetStateAction<number>>
  setPlotConfig: Dispatch<SetStateAction<PlotConfig>>
  setShowGenerateColorsConfirm: Dispatch<SetStateAction<boolean>>
}

export function usePlotConfigActions({
  activeDataframeIndex,
  activeFrameIndex,
  setActiveDataframeIndex,
  setActiveFrameIndex,
  setPlotConfig,
  setShowGenerateColorsConfirm,
}: Params) {
const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
  setPlotConfig((current) => ({ ...current, dataframes: current.dataframes.map((df, i) => (i === index ? patch(df) : df)) }))
}
const patchActiveDataframe = (patch: (current: DataframeConfig) => DataframeConfig) => patchDataframe(activeDataframeIndex, patch)
const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => {
  patchActiveDataframe((df) => ({ ...df, frames: df.frames.map((frame, i) => (i === activeFrameIndex ? patch(frame) : frame)) }))
}
const toggleDataframeGeneration = (index: number, enabled: boolean) => {
  setPlotConfig((current) => ({ ...current, createAllDataframes: toggleIndexSelection(current.dataframes.length, current.createAllDataframes, index, enabled) }))
}
const toggleFrameGeneration = (dataframeIndex: number, index: number, enabled: boolean) => {
  patchDataframe(dataframeIndex, (df) => ({ ...df, createAllFrames: toggleIndexSelection(df.frames.length, df.createAllFrames, index, enabled) }))
}

const addDataframe = () => {
  setPlotConfig((current) => {
    const nextIndex = current.dataframes.length
    const source = structuredClone(current.dataframes[0])
    source.name = nextDataframeName(current.dataframes)
    refreshUiKey(source, 'dataframe')
    source.frames = source.frames.map((frame, frameIndex) => {
      const nextFrame = { ...frame, name: `Frame ${frameIndex + 1}` }
      refreshUiKey(nextFrame, 'frame')
      return nextFrame
    })
    setActiveDataframeIndex(nextIndex)
    setActiveFrameIndex(0)
    const nextDataframes = [...current.dataframes, source]
    return {
      ...current,
      dataframes: nextDataframes,
      createAllDataframes: insertSelectionIndex(nextDataframes.length, current.createAllDataframes, nextIndex),
    }
  })
}

/** Adds a frame (a copy of the first one) to a dataframe and selects it. */
const addFrame = (dataframeIndex: number = activeDataframeIndex) => {
  setPlotConfig((current) => {
    const df = current.dataframes[dataframeIndex]
    if (!df) return current
    const next = structuredClone(df.frames[0])
    next.darkMode = undefined
    next.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
    refreshUiKey(next, 'frame')
    const nextFrames = [...df.frames, next]
    setActiveDataframeIndex(dataframeIndex)
    setActiveFrameIndex(nextFrames.length - 1)
    return {
      ...current,
      dataframes: current.dataframes.map((entry, index) => (index === dataframeIndex
        ? { ...entry, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, entry.createAllFrames, nextFrames.length - 1) }
        : entry)),
    }
  })
}

const duplicateDataframe = (index: number) => {
  setPlotConfig((current) => {
    const original = current.dataframes[index]
    if (!original) return current
    const clone = structuredClone(original)
    clone.name = nextDataframeName(current.dataframes)
    refreshUiKey(clone, 'dataframe')
    clone.frames.forEach((frame) => refreshUiKey(frame, 'frame'))
    const nextDataframes = [...current.dataframes]
    nextDataframes.splice(index + 1, 0, clone)
    setActiveDataframeIndex(index + 1)
    setActiveFrameIndex(0)
    return {
      ...current,
      dataframes: nextDataframes,
      createAllDataframes: insertSelectionIndex(nextDataframes.length, current.createAllDataframes, index + 1),
    }
  })
}

const duplicateFrame = (dataframeIndex: number, index: number) => {
  patchDataframe(dataframeIndex, (df) => {
    const original = df.frames[index]
    if (!original) return df
    const clone = structuredClone(original)
    clone.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
    refreshUiKey(clone, 'frame')
    const nextFrames = [...df.frames]
    nextFrames.splice(index + 1, 0, clone)
    setActiveDataframeIndex(dataframeIndex)
    setActiveFrameIndex(index + 1)
    return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, index + 1) }
  })
}

/**
 * Moves a plot to `targetIndex` (0 … number of plots; the plot is placed before the one currently
 * there) of the same or another dataset. The moved plot becomes the active one and keeps its
 * "include" state. A dataset keeps at least one plot.
 */
const moveFrame = (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number, targetIndex: number) => {
  if (sourceDataframeIndex === targetDataframeIndex) {
    const to = targetIndex > sourceFrameIndex ? targetIndex - 1 : targetIndex
    if (to === sourceFrameIndex) return
    patchDataframe(sourceDataframeIndex, (df) => {
      const nextFrames = moveItem(df.frames, sourceFrameIndex, to)
      return { ...df, frames: nextFrames, createAllFrames: reorderSelectionIndices(nextFrames.length, df.createAllFrames, sourceFrameIndex, to) }
    })
    setActiveDataframeIndex(sourceDataframeIndex)
    setActiveFrameIndex(to)
    return
  }
  setPlotConfig((current) => {
    const sourceDataframe = current.dataframes[sourceDataframeIndex]
    const targetDataframe = current.dataframes[targetDataframeIndex]
    const frameToMove = sourceDataframe?.frames[sourceFrameIndex]
    if (!sourceDataframe || !targetDataframe || !frameToMove || sourceDataframe.frames.length <= 1) {
      return current
    }
    const included = getSelectedIndices(sourceDataframe.frames.length, sourceDataframe.createAllFrames).includes(sourceFrameIndex)
    const insertAt = Math.min(Math.max(targetIndex, 0), targetDataframe.frames.length)
    const nextDataframes = current.dataframes.map((df, index) => {
      if (index === sourceDataframeIndex) {
        const nextFrames = df.frames.filter((_, frameIndex) => frameIndex !== sourceFrameIndex)
        return { ...df, frames: nextFrames, createAllFrames: removeSelectionIndex(nextFrames.length, df.createAllFrames, sourceFrameIndex) }
      }
      if (index === targetDataframeIndex) {
        const nextFrames = [...df.frames.slice(0, insertAt), frameToMove, ...df.frames.slice(insertAt)]
        const shifted = insertSelectionIndex(nextFrames.length, df.createAllFrames, insertAt)
        return { ...df, frames: nextFrames, createAllFrames: toggleIndexSelection(nextFrames.length, shifted, insertAt, included) }
      }
      return df
    })
    setActiveDataframeIndex(targetDataframeIndex)
    setActiveFrameIndex(insertAt)
    return { ...current, dataframes: nextDataframes }
  })
}

const removeDataframe = (index: number) => {
  setPlotConfig((current) => {
    if (current.dataframes.length <= 1) {
      return current
    }
    const nextDataframes = current.dataframes.filter((_, i) => i !== index)
    if (index === activeDataframeIndex) {
      setActiveDataframeIndex(Math.min(index, nextDataframes.length - 1))
      setActiveFrameIndex(0)
    } else if (index < activeDataframeIndex) {
      setActiveDataframeIndex(activeDataframeIndex - 1)
    }
    return {
      ...current,
      dataframes: nextDataframes,
      createAllDataframes: removeSelectionIndex(nextDataframes.length, current.createAllDataframes, index),
    }
  })
}

const removeFrame = (dataframeIndex: number, index: number) => {
  patchDataframe(dataframeIndex, (df) => {
    if (df.frames.length <= 1) {
      return df
    }
    const nextFrames = df.frames.filter((_, i) => i !== index)
    if (dataframeIndex === activeDataframeIndex && (index < activeFrameIndex || activeFrameIndex >= nextFrames.length)) {
      setActiveFrameIndex(Math.max(0, activeFrameIndex - 1))
    }
    return { ...df, frames: nextFrames, createAllFrames: removeSelectionIndex(nextFrames.length, df.createAllFrames, index) }
  })
}

const reorderDataframes = (from: number, to: number) => {
  setPlotConfig((current) => {
    const nextDataframes = moveItem(current.dataframes, from, to)
    return {
      ...current,
      dataframes: nextDataframes,
      createAllDataframes: reorderSelectionIndices(nextDataframes.length, current.createAllDataframes, from, to),
    }
  })
  if (activeDataframeIndex === from) {
    setActiveDataframeIndex(to)
  } else if (from < activeDataframeIndex && to >= activeDataframeIndex) {
    setActiveDataframeIndex((prev) => prev - 1)
  } else if (from > activeDataframeIndex && to <= activeDataframeIndex) {
    setActiveDataframeIndex((prev) => prev + 1)
  }
}

const generateMaterialColors = () => {
  patchActiveDataframe((df) => generateMaterialColorsForDataframe(df))
  setShowGenerateColorsConfirm(false)
}



const addAxis = () => {
  patchActiveDataframe((df) => addAxisToDataframe(df))
}

const addLayer = () => {
  patchActiveFrame((frame) => addLayerToFrame(frame))
}

const addGuideline = () => {
  patchActiveFrame((frame) => addGuidelineToFrame(frame))
}

const updateAxis = (axisIndex: number, patch: (axis: AxisConfig) => AxisConfig) => {
  patchActiveDataframe((df) => updateAxisInDataframe(df, axisIndex, patch))
}

const updateGuideline = (guidelineIndex: number, patch: (guideline: GuidelineConfig) => GuidelineConfig) => {
  patchActiveFrame((frame) => updateGuidelineInFrame(frame, guidelineIndex, patch))
}

const removeAxis = (axisIndex: number) => {
  patchActiveDataframe((df) => {
    if (df.axes.length <= 1) {
      return df
    }
    const nextAxes = df.axes.filter((_, index) => index !== axisIndex)
    const fallbackAxis = nextAxes[0]?.name ?? ''
    return {
      ...df,
      axes: nextAxes,
      frames: df.frames.map((frame) => ({
        ...frame,
        xQuantity: nextAxes.some((axis) => axis.name === frame.xQuantity) ? frame.xQuantity : fallbackAxis,
        yQuantity: nextAxes.some((axis) => axis.name === frame.yQuantity) ? frame.yQuantity : fallbackAxis,
      })),
    }
  })
}


  return {
    addAxis,
    addDataframe,
    addFrame,
    addGuideline,
    addLayer,
    duplicateDataframe,
    duplicateFrame,
    generateMaterialColors,
    moveFrame,
    patchActiveDataframe,
    patchActiveFrame,
    patchDataframe,
    removeAxis,
    removeDataframe,
    removeFrame,
    reorderDataframes,
    toggleDataframeGeneration,
    toggleFrameGeneration,
    updateAxis,
    updateGuideline,
  }
}
