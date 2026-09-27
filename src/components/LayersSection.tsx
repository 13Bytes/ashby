import type { Dispatch, SetStateAction } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { PLOT_ALGORITHMS, type FrameConfig, type LayerConfig } from '../config/defaultPlotConfig'
import { DEFAULT_FRAME, DEFAULT_LAYER } from '../config/settingsSections'
import { useI18n } from '../uiTranslations'
import { numberValue, type MultiOption } from '../utils/appState'
import { resolvePreviewColor } from '../utils/colors'
import { useSettings } from '../utils/settingsContext'
import { Field, ItemCard, MultiSelectInput, SettingsGroup, SharedHint } from './AppControls'
import { useOpenItems } from '../hooks/useOpenItems'

type Props = {
  activeFrame: FrameConfig
  materialColors: Record<string, string>
  patchActiveFrame: (updater: (frame: FrameConfig) => FrameConfig) => void
  addLayer: () => void
  layerNameOptions: MultiOption[]
  availableKeywordsByColumn: Record<string, string[]>
  availableWhitelistKeywords: MultiOption[]
  expandedLayerKeywords: Record<number, boolean>
  setExpandedLayerKeywords: Dispatch<SetStateAction<Record<number, boolean>>>
}

/** Hull layers of the active frame; the first layer's column is required. */
export function LayersSection({ activeFrame, materialColors, patchActiveFrame, addLayer, layerNameOptions, availableKeywordsByColumn, availableWhitelistKeywords, expandedLayerKeywords, setExpandedLayerKeywords }: Props) {
  const { t } = useI18n()
  const { goTo } = useSettings()
  const openItems = useOpenItems(String(activeFrame._extensions.uiKey))
  const patchLayer = (layerIndex: number, patch: (layer: LayerConfig) => LayerConfig) =>
    patchActiveFrame((f) => ({ ...f, layers: f.layers.map((x, i) => (i === layerIndex ? patch(x) : x)) }))
  const lastLayer = activeFrame.layers[activeFrame.layers.length - 1]
  const patchLastLayer = (patch: (layer: LayerConfig) => LayerConfig) => patchLayer(activeFrame.layers.length - 1, patch)
  const columnSelect = (layerIndex: number, layer: LayerConfig) => (
    <Select value={layer.name ?? ''} onChange={(e) => patchLayer(layerIndex, (x) => ({ ...x, name: e.target.value }))}>
      <option value="">{t('selectColumn')}</option>
      {layerNameOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
  )
  const firstLayer = activeFrame.layers[0]

  return (
    <>
      {firstLayer ? (
        <Field label={t('groupMaterialsBy')} jsonPath="layers[0].name" level="required" missing={!firstLayer.name?.trim()} anchor="groupMaterialsBy" hint={t('groupMaterialsHint')} selfClassName="simple-only max-w-md">
          {columnSelect(0, firstLayer)}
        </Field>
      ) : null}

      <SettingsGroup title={t('layers')} level="default" actions={<Button variant="outline" size="sm" onClick={() => {
        openItems.added(activeFrame.layers.length)
        addLayer()
      }}>+ {t('layer')}</Button>}>
        <div className="grid gap-2">
          {activeFrame.layers.map((layer, layerIndex) => (
            <ItemCard
              key={layerIndex}
              title={`${t('layer')} ${layerIndex + 1}`}
              summary={layer.name ? t('layerSummary', { column: layer.name }) : t('noColumn')}
              open={openItems.isOpen(layerIndex)}
              onOpenChange={(next) => openItems.setOpen(layerIndex, next)}
              onDuplicate={() => {
                openItems.inserted(layerIndex + 1)
                patchActiveFrame((f) => ({ ...f, layers: [...f.layers.slice(0, layerIndex + 1), structuredClone(f.layers[layerIndex]), ...f.layers.slice(layerIndex + 1)] }))
              }}
              onRemove={() => {
                openItems.removed(layerIndex)
                patchActiveFrame((f) => ({ ...f, layers: f.layers.filter((_, i) => i !== layerIndex) }))
              }}
              removeDisabled={activeFrame.layers.length <= 1}
            >
              <div className="grid items-stretch gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="grid content-start gap-4">
                  <Field label={t('layerName', { n: layerIndex + 1 })} jsonPath={`layers[${layerIndex}].name`} level={layerIndex === 0 ? 'required' : 'check'} missing={layerIndex === 0 ? !layer.name?.trim() : undefined} anchor={layerIndex === 0 ? 'groupMaterialsBy' : undefined}>
                    {columnSelect(layerIndex, layer)}
                  </Field>
                  <Field label={t('lineWidth')} jsonPath={`layers[${layerIndex}].linewidth`} level="default" changed={(layer.linewidth ?? 1.5) !== DEFAULT_LAYER.linewidth}>
                    <Input type="number" step={0.1} min={0} value={layer.linewidth ?? 1.5} onChange={(e) => patchLayer(layerIndex, (x) => ({ ...x, linewidth: Math.max(0, numberValue(e.target.valueAsNumber, x.linewidth ?? 1.5)) }))} />
                  </Field>
                  <Field label={t('alpha')} jsonPath={`layers[${layerIndex}].alpha`} level="default" changed={layer.alpha !== undefined && layer.alpha !== DEFAULT_LAYER.alpha}>
                    <Input type="number" step={0.05} min={0} max={1} value={layer.alpha ?? ''} onChange={(e) => patchLayer(layerIndex, (x) => ({ ...x, alpha: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
                  </Field>
                </div>
                <Field label={t('whitelistKeywords')} jsonPath={`layers[${layerIndex}].whitelist`} level="default" changed={(layer.whitelist ?? []).length > 0 || Boolean(layer.whitelistFlag)} fill>
                  <MultiSelectInput
                    title=""
                    colorFor={(keyword) => (keyword in materialColors ? resolvePreviewColor(keyword, materialColors) : undefined)}
                    value={layer.whitelist ?? []}
                    options={!layer.name ? [] : (availableKeywordsByColumn[layer.name] ?? []).length > 0 ? (availableKeywordsByColumn[layer.name] ?? []).map((entry) => ({ value: entry, label: entry })) : availableWhitelistKeywords}
                    expanded={expandedLayerKeywords[layerIndex] === true}
                    onToggleExpanded={() => setExpandedLayerKeywords((current) => ({ ...current, [layerIndex]: !current[layerIndex] }))}
                    modeValue={layer.whitelistFlag ?? false}
                    onModeChange={(next) => patchLayer(layerIndex, (x) => ({ ...x, whitelistFlag: next }))}
                    onChange={(next) => patchLayer(layerIndex, (x) => ({ ...x, whitelist: next }))}
                  />
                </Field>
              </div>
            </ItemCard>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t('allLayers')} level="default">
        <div className="grid gap-4 @lg:grid-cols-3">
          <Field label={t('algorithm')} jsonPath="frames[j].algorithm" level="default" changed={activeFrame.algorithm !== DEFAULT_FRAME.algorithm}>
            <Select value={activeFrame.algorithm} onChange={(e) => patchActiveFrame((c) => ({ ...c, algorithm: e.target.value as FrameConfig['algorithm'] }))}>
              {PLOT_ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label={t('alphaPoints')} jsonPath="layers[last].alpha_points" level="default" changed={lastLayer?.alphaPoints !== undefined}>
            <Input type="number" step={0.05} min={0} max={1} value={lastLayer?.alphaPoints ?? ''} onChange={(e) => patchLastLayer((x) => ({ ...x, alphaPoints: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
          </Field>
          <Field label={t('alphaAreas')} jsonPath="layers[last].alpha_areas" level="default" changed={lastLayer?.alphaAreas !== undefined}>
            <Input type="number" step={0.05} min={0} max={1} value={lastLayer?.alphaAreas ?? ''} onChange={(e) => patchLastLayer((x) => ({ ...x, alphaAreas: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : undefined }))} />
          </Field>
        </div>
      </SettingsGroup>

      <SharedHint text={t('legendShared')} linkLabel={t('openMaterials')} onOpen={() => goTo('materials')} />
    </>
  )
}
