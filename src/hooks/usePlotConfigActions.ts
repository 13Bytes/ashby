import type { Dispatch, SetStateAction } from 'react'
import type { AxisConfig, DataframeConfig, FrameConfig, GuidelineConfig, PlotConfig } from '../config/defaultPlotConfig'
import { addAxisToDataframe, addGuidelineToFrame, addLayerToFrame, generateMaterialColorsForDataframe, updateAxisInDataframe, updateGuidelineInFrame } from '../utils/configEditing'
import { duplicateFrameInDataframe, getNextTabName, insertSelectionIndex, moveFrameInConfig, moveItem, nextDataframeName, refreshUiKey, removeSelectionIndex, reorderSelectionIndices, toggleIndexSelection } from '../utils/appState'

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
// A patch that returns its input unchanged keeps the config object, so nothing re-renders or syncs.
const patchDataframe = (index: number, patch: (current: DataframeConfig) => DataframeConfig) => {
  setPlotConfig((current) => {
    const dataframe = current.dataframes[index]
    if (!dataframe) return current
    const next = patch(dataframe)
    return next === dataframe ? current : { ...current, dataframes: current.dataframes.map((df, i) => (i === index ? next : df)) }
  })
}
const patchActiveDataframe = (patch: (current: DataframeConfig) => DataframeConfig) => patchDataframe(activeDataframeIndex, patch)
const patchActiveFrame = (patch: (current: FrameConfig) => FrameConfig) => {
  patchActiveDataframe((df) => {
    const frame = df.frames[activeFrameIndex]
    if (!frame) return df
    const next = patch(frame)
    return next === frame ? df : { ...df, frames: df.frames.map((entry, i) => (i === activeFrameIndex ? next : entry)) }
  })
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
    const result = duplicateFrameInDataframe(df, index)
    if (!result) return df
    setActiveDataframeIndex(dataframeIndex)
    setActiveFrameIndex(result.frameIndex)
    return result.dataframe
  })
}

/** Moves a plot within or between dataframes (see `moveFrameInConfig`) and selects it. */
const moveFrame = (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number, targetIndex: number) => {
  setPlotConfig((current) => {
    const result = moveFrameInConfig(current, sourceDataframeIndex, sourceFrameIndex, targetDataframeIndex, targetIndex)
    if (!result) return current
    setActiveDataframeIndex(result.position.dataframeIndex)
    setActiveFrameIndex(result.position.frameIndex)
    return result.config
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
