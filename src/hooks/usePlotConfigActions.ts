import type { Dispatch, SetStateAction } from 'react'
import type { AxisConfig, DataframeConfig, FrameConfig, GuidelineConfig, PlotConfig } from '../config/defaultPlotConfig'
import { addAxisToDataframe, updateAxisInDataframe } from '../components/AxesSection'
import { addGuidelineToFrame, updateGuidelineInFrame } from '../components/GuidelinesSection'
import { addLayerToFrame } from '../components/LayersSection'
import { generateMaterialColorsForDataframe } from '../components/MaterialColorsSection'
import { getNextTabName, insertSelectionIndex, moveItem, removeSelectionIndex, reorderSelectionIndices, toggleIndexSelection } from '../utils/appState'

type Params = {
  activeDataframe: DataframeConfig
  activeDataframeIndex: number
  activeFrameIndex: number
  setActiveDataframeIndex: Dispatch<SetStateAction<number>>
  setActiveFrameIndex: Dispatch<SetStateAction<number>>
  setPlotConfig: Dispatch<SetStateAction<PlotConfig>>
  setShowGenerateColorsConfirm: Dispatch<SetStateAction<boolean>>
}

export function usePlotConfigActions({
  activeDataframe,
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
const toggleFrameGeneration = (index: number, enabled: boolean) => {
  patchActiveDataframe((df) => ({ ...df, createAllFrames: toggleIndexSelection(df.frames.length, df.createAllFrames, index, enabled) }))
}

const addDataframe = () => {
  setPlotConfig((current) => {
    const nextIndex = current.dataframes.length
    const source = structuredClone(current.dataframes[0])
    source.name = getNextTabName(current.dataframes.map((df, index) => df.name ?? `Dataframe ${index + 1}`), 'Dataframe')
    source.frames = source.frames.map((frame, frameIndex) => ({ ...frame, name: `Frame ${frameIndex + 1}` }))
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

const addFrame = () => {
  patchActiveDataframe((df) => {
    const next = structuredClone(df.frames[0])
    next.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
    const nextFrames = [...df.frames, next]
    return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, nextFrames.length - 1) }
  })
  setActiveFrameIndex(activeDataframe.frames.length)
}

const duplicateDataframe = (index: number) => {
  setPlotConfig((current) => {
    const original = current.dataframes[index]
    if (!original) return current
    const clone = structuredClone(original)
    clone.name = getNextTabName(current.dataframes.map((df) => df.name), 'Dataframe')
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

const duplicateFrame = (index: number) => {
  patchActiveDataframe((df) => {
    const original = df.frames[index]
    if (!original) return df
    const clone = structuredClone(original)
    clone.name = getNextTabName(df.frames.map((frame) => frame.name), 'Frame')
    const nextFrames = [...df.frames]
    nextFrames.splice(index + 1, 0, clone)
    setActiveFrameIndex(index + 1)
    return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, index + 1) }
  })
}

const moveFrameToDataframe = (sourceDataframeIndex: number, sourceFrameIndex: number, targetDataframeIndex: number) => {
  if (sourceDataframeIndex === targetDataframeIndex) return
  setPlotConfig((current) => {
    const sourceDataframe = current.dataframes[sourceDataframeIndex]
    const targetDataframe = current.dataframes[targetDataframeIndex]
    if (!sourceDataframe || !targetDataframe || sourceDataframe.frames.length <= 1) {
      return current
    }
    const frameToMove = sourceDataframe.frames[sourceFrameIndex]
    if (!frameToMove) return current
    const nextDataframes = current.dataframes.map((df, index) => {
      if (index === sourceDataframeIndex) {
        const nextFrames = df.frames.filter((_, frameIndex) => frameIndex !== sourceFrameIndex)
        return { ...df, frames: nextFrames, createAllFrames: removeSelectionIndex(nextFrames.length, df.createAllFrames, sourceFrameIndex) }
      }
      if (index === targetDataframeIndex) {
        const nextFrames = [...df.frames, frameToMove]
        return { ...df, frames: nextFrames, createAllFrames: insertSelectionIndex(nextFrames.length, df.createAllFrames, nextFrames.length - 1) }
      }
      return df
    })
    setActiveDataframeIndex(targetDataframeIndex)
    setActiveFrameIndex(nextDataframes[targetDataframeIndex].frames.length - 1)
    return {
      ...current,
      dataframes: nextDataframes,
      createAllDataframes: current.createAllDataframes,
    }
  })
}

const removeDataframe = (index: number) => {
  setPlotConfig((current) => {
    if (current.dataframes.length <= 1) {
      return current
    }
    const nextDataframes = current.dataframes.filter((_, i) => i !== index)
    setActiveDataframeIndex((prev) => Math.max(0, Math.min(prev, nextDataframes.length - 1)))
    setActiveFrameIndex(0)
    return { ...current, dataframes: nextDataframes }
  })
}

const removeFrame = (index: number) => {
  patchActiveDataframe((df) => {
    if (df.frames.length <= 1) {
      return df
    }
    const nextFrames = df.frames.filter((_, i) => i !== index)
    setActiveFrameIndex((prev) => Math.max(0, Math.min(prev, nextFrames.length - 1)))
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

const reorderFrames = (from: number, to: number) => {
  patchActiveDataframe((df) => {
    const nextFrames = moveItem(df.frames, from, to)
    return { ...df, frames: nextFrames, createAllFrames: reorderSelectionIndices(nextFrames.length, df.createAllFrames, from, to) }
  })
  if (activeFrameIndex === from) {
    setActiveFrameIndex(to)
  } else if (from < activeFrameIndex && to >= activeFrameIndex) {
    setActiveFrameIndex((prev) => prev - 1)
  } else if (from > activeFrameIndex && to <= activeFrameIndex) {
    setActiveFrameIndex((prev) => prev + 1)
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
    moveFrameToDataframe,
    patchActiveDataframe,
    patchActiveFrame,
    patchDataframe,
    removeAxis,
    removeDataframe,
    removeFrame,
    reorderDataframes,
    reorderFrames,
    toggleDataframeGeneration,
    toggleFrameGeneration,
    updateAxis,
    updateGuideline,
  }
}
