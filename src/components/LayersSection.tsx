import type { Dispatch, SetStateAction } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { FrameConfig } from '../config/defaultPlotConfig'
import type { UILanguage } from '../uiTranslations'

type MultiOption = { value: string; label: string }

type Props = {
  t: (key: string) => string
  uiLanguage: UILanguage
  activeFrame: FrameConfig
  hoveredRemoveGroup: string | null
  setHoveredRemoveGroup: (value: string | null) => void
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  addLayer: () => void
  layerNameOptions: MultiOption[]
  availableKeywordsByColumn: Record<string, string[]>
  availableWhitelistKeywords: MultiOption[]
  expandedLayerKeywords: Record<number, boolean>
  setExpandedLayerKeywords: Dispatch<SetStateAction<Record<number, boolean>>>
  numberValue: (value: number, fallback: number) => number
  FieldComponent: any
  MultiSelectInputComponent: any
  RemoveIconButtonComponent: any
}

export const addLayerToFrame = (frame: FrameConfig): FrameConfig => ({
  ...frame,
  layers: [...frame.layers, { name: '', whitelist: [], alphaPoints: undefined, alphaAreas: undefined, linewidth: 1.5, alpha: undefined, whitelistFlag: false }],
})

export function LayersSection({ t, uiLanguage, activeFrame, hoveredRemoveGroup, setHoveredRemoveGroup, patchActiveFrame, addLayer, layerNameOptions, availableKeywordsByColumn, availableWhitelistKeywords, expandedLayerKeywords, setExpandedLayerKeywords, numberValue, FieldComponent: Field, MultiSelectInputComponent: MultiSelectInput, RemoveIconButtonComponent: RemoveIconButton }: Props) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{t('layers')}</h3>
        <Button variant="outline" size="sm" onClick={addLayer}>+ Layer</Button>
      </div>

      <div className="relative grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <Field language={uiLanguage} label="Alpha points" jsonPath="layers[last].alpha_points">
          <Input type="number" step={0.05} min={0} max={1} value={activeFrame.layers[activeFrame.layers.length - 1]?.alphaPoints ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === f.layers.length - 1 ? { ...x, alphaPoints: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} />
        </Field>
        <Field language={uiLanguage} label="Alpha areas" jsonPath="layers[last].alpha_areas">
          <Input type="number" step={0.05} min={0} max={1} value={activeFrame.layers[activeFrame.layers.length - 1]?.alphaAreas ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === f.layers.length - 1 ? { ...x, alphaAreas: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} />
        </Field>
      </div>

      {activeFrame.layers.map((layer, layerIndex) => (
        <div key={layerIndex} className={`relative grid gap-2 rounded-lg border p-3 pr-12 sm:col-span-2 sm:grid-cols-2 ${hoveredRemoveGroup === `layer-${layerIndex}` ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
          <RemoveIconButton onHoverChange={(hovered: boolean) => setHoveredRemoveGroup(hovered ? `layer-${layerIndex}` : null)} onClick={() => patchActiveFrame((f) => ({ ...f, layers: f.layers.filter((_, i) => i !== layerIndex) }))} />
          <div className="grid gap-3">
            <Field language={uiLanguage} label={`Layer ${layerIndex + 1} Name`} jsonPath={`layers[${layerIndex}].name`}>
              <Select value={layer.name ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, name: e.target.value } : x) }))}>
                <option value="">Select column</option>
                {layerNameOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <Field language={uiLanguage} label="Line width" jsonPath={`layers[${layerIndex}].linewidth`}>
              <Input type="number" step={0.1} min={0} value={layer.linewidth ?? 1.5} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, linewidth: Math.max(0, numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5)) } : x) }))} />
            </Field>
            <Field language={uiLanguage} label={t('alpha')} jsonPath={`layers[${layerIndex}].alpha`}>
              <Input type="number" step={0.05} min={0} max={1} value={layer.alpha ?? ''} onChange={(e) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined } : x) }))} />
            </Field>
          </div>

          <MultiSelectInput
            title="Whitelist keywords"
            value={layer.whitelist ?? []}
            options={!layer.name ? [] : (availableKeywordsByColumn[layer.name] ?? []).length > 0 ? (availableKeywordsByColumn[layer.name] ?? []).map((entry: string) => ({ value: entry, label: entry })) : availableWhitelistKeywords}
            expanded={expandedLayerKeywords[layerIndex] === true}
            onToggleExpanded={() => setExpandedLayerKeywords((current) => ({ ...current, [layerIndex]: !current[layerIndex] }))}
            modeValue={layer.whitelistFlag ?? false}
            onModeChange={(next: boolean) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => (i === layerIndex ? { ...x, whitelistFlag: next } : x)) }))}
            onChange={(next: string[]) => patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => i === layerIndex ? { ...x, whitelist: next } : x) }))}
          />
        </div>
      ))}
    </section>
  )
}
