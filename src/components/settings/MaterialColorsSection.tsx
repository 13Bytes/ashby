import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Button } from '../ui/button'
import type { DataframeConfig } from '../../config/defaultPlotConfig'
import { CUSTOM_SELECT_VALUE } from '../../config/uiOptions'
import { useI18n } from '../../uiTranslations'
import { populateMaterialColorsForDataframe } from '../../utils/configEditing'
import { DEFAULT_DATAFRAME } from '../../config/settingsSections'
import { Field, LanguageFields, Toggle, SettingsGroup } from '../common/AppControls'
import { ColorDot } from '../common/ColorPicker'

type Props = {
  activeDataframe: DataframeConfig
  customMaterialNames: Record<string, string>
  setCustomMaterialNames: Dispatch<SetStateAction<Record<string, string>>>
  includedLayerKeywords: string[]
  materialKeywordOptions: string[]
  patchActiveDataframe: (updater: (dataframe: DataframeConfig) => DataframeConfig) => void
  setShowGenerateColorsConfirm: (value: boolean) => void
}

/** Renames a material color entry and keeps the order of the entries. */
const renameMaterial = (df: DataframeConfig, material: string, nextName: string): DataframeConfig => {
  const nextKey = nextName.trim()
  if (!nextKey || nextKey === material || df.materialColors[nextKey] !== undefined) return df
  const nextColors = Object.fromEntries(Object.entries(df.materialColors).map(([key, value]) => [key === material ? nextKey : key, value]))
  return { ...df, materialColors: nextColors }
}

/** Legend title and position and the material colors; shared by all frames of the dataframe. */
export function MaterialColorsSection({
  activeDataframe,
  customMaterialNames,
  setCustomMaterialNames,
  includedLayerKeywords,
  materialKeywordOptions,
  patchActiveDataframe,
  setShowGenerateColorsConfirm,
}: Props) {
  const { t } = useI18n()
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  useEffect(() => {
    if (!confirmDeleteAll) return
    const timer = window.setTimeout(() => setConfirmDeleteAll(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmDeleteAll])
  // "default" (points without a material color) is kept
  const deletableCount = Object.keys(activeDataframe.materialColors).filter((material) => material !== 'default').length
  const setColor = (material: string, color: string) =>
    patchActiveDataframe((df) => ({ ...df, materialColors: { ...df.materialColors, [material]: color } }))

  return (
    <>
      <div className="grid gap-4 @lg:grid-cols-2">
        <LanguageFields
          label={t('legendTitle')}
          jsonPath="dataframes[i].legend_title"
          level="check"
          languages={activeDataframe.plotLanguages}
          selectedLanguage={activeDataframe.language}
          value={(lang) => activeDataframe.legendTitle[lang] ?? ''}
          onChange={(lang, next) => patchActiveDataframe((df) => ({ ...df, legendTitle: { ...df.legendTitle, [lang]: next } }))}
        />
        <Field label={t('legendPosition')} jsonPath="dataframes[i].legend_above" level="default" changed={activeDataframe.legendAbove !== DEFAULT_DATAFRAME.legendAbove} onReset={() => patchActiveDataframe((df) => ({ ...df, legendAbove: DEFAULT_DATAFRAME.legendAbove }))}>
          <Toggle<'right' | 'above' | 'none'>
            ariaLabel={t('legendPosition')}
            value={activeDataframe.legendAbove === null ? 'none' : activeDataframe.legendAbove ? 'above' : 'right'}
            onChange={(next) => patchActiveDataframe((df) => ({ ...df, legendAbove: next === 'none' ? null : next === 'above' }))}
            options={[{ value: 'right', label: t('legendRight') }, { value: 'above', label: t('legendAbove') }, { value: 'none', label: t('legendNone') }]}
          />
        </Field>
      </div>

      <SettingsGroup
        actions={(
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patchActiveDataframe((df) => {
                  let key = ''
                  while (df.materialColors[key] !== undefined) key += ' '
                  return { ...df, materialColors: { ...df.materialColors, [key]: '#000000' } }
                })
              }
            >
              + {t('color')}
            </Button>
            <Button type="button" variant="outline" size="sm" title={t('populateColorsHint')} onClick={() => patchActiveDataframe((df) => populateMaterialColorsForDataframe(df, includedLayerKeywords))}>
              {t('populateColors')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowGenerateColorsConfirm(true)}>
              {t('generateColors')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletableCount === 0}
              className={confirmDeleteAll ? 'border-red-500 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white' : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'}
              title={t('deleteAllColorsHint')}
              onClick={() => {
                if (!confirmDeleteAll) {
                  setConfirmDeleteAll(true)
                  return
                }
                setConfirmDeleteAll(false)
                patchActiveDataframe((df) => ({ ...df, materialColors: Object.fromEntries(Object.entries(df.materialColors).filter(([key]) => key === 'default')) }))
              }}
            >
              {confirmDeleteAll ? t('deleteAllColorsConfirm', { count: deletableCount }) : t('deleteAllColors')}
            </Button>
          </>
        )}
      >
        <Field label={t('materialColors')} jsonPath="material_colors" level="check">
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeDataframe.materialColors).map(([material, color]) => {
              const isDefault = material === 'default'
              const customDraft = customMaterialNames[material]
              return (
                <div key={material} className="group flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white pl-1.5 pr-1 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
                  <ColorDot value={color} onChange={(next) => setColor(material, next)} label={`${t('color')} · ${material}`} size="sm" presets={Object.values(activeDataframe.materialColors)} />
                  {isDefault ? (
                    <span className="truncate px-1 text-sm font-medium">{material}</span>
                  ) : customDraft !== undefined ? (
                    <input
                      autoFocus
                      className="h-7 w-36 rounded-full border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={customDraft}
                      placeholder={t('customMaterialName')}
                      onChange={(event) => setCustomMaterialNames((current) => ({ ...current, [material]: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      onBlur={() => {
                        patchActiveDataframe((df) => renameMaterial(df, material, customMaterialNames[material] ?? ''))
                        setCustomMaterialNames((current) => {
                          const next = { ...current }
                          delete next[material]
                          return next
                        })
                      }}
                    />
                  ) : (
                    <select
                      className="h-7 max-w-44 cursor-pointer appearance-none truncate rounded-md border-0 bg-transparent px-1 text-sm font-medium [field-sizing:content] hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                      value={material}
                      aria-label={t('customMaterialName')}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        if (nextValue === CUSTOM_SELECT_VALUE) {
                          setCustomMaterialNames((current) => ({ ...current, [material]: material }))
                          return
                        }
                        patchActiveDataframe((df) => renameMaterial(df, material, nextValue))
                      }}
                    >
                      <option value={material}>{material.trim() || '…'}</option>
                      {/* a keyword has one color: the ones with an entry are left out */}
                      {materialKeywordOptions.filter((keyword) => activeDataframe.materialColors[keyword] === undefined).map((keyword) => <option key={keyword} value={keyword}>{keyword}</option>)}
                      <option value={CUSTOM_SELECT_VALUE}>{t('custom')}</option>
                    </select>
                  )}
                  <input
                    className="h-7 w-[4.75rem] shrink-0 rounded-md border-0 bg-transparent px-1 font-mono text-xs text-zinc-500 hover:bg-zinc-100 focus-visible:bg-white focus-visible:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-900 dark:focus-visible:text-zinc-100"
                    value={color}
                    aria-label={`${t('color')} ${material}`}
                    onChange={(event) => setColor(material, event.target.value)}
                  />
                  {!isDefault ? (
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 opacity-0 hover:bg-red-500 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => patchActiveDataframe((df) => ({ ...df, materialColors: Object.fromEntries(Object.entries(df.materialColors).filter(([key]) => key !== material)) }))}
                      aria-label={t('removeNamed', { name: material })}
                      title={t('removeNamed', { name: material })}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Field>
      </SettingsGroup>
    </>
  )
}
