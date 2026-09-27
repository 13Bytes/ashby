import type { Dispatch, SetStateAction } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { DataframeConfig } from '../config/defaultPlotConfig'
import { CUSTOM_SELECT_VALUE } from '../config/uiOptions'
import { useI18n } from '../uiTranslations'
import { populateMaterialColorsForDataframe } from '../utils/configEditing'
import { SectionHeading } from './AppControls'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

type Props = {
  activeDataframe: DataframeConfig
  customMaterialNames: Record<string, string>
  setCustomMaterialNames: Dispatch<SetStateAction<Record<string, string>>>
  includedLayerKeywords: string[]
  materialKeywordOptions: string[]
  patchActiveDataframe: (updater: (dataframe: DataframeConfig) => DataframeConfig) => void
  setShowGenerateColorsConfirm: (value: boolean) => void
}

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
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-transparent sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SectionHeading title={t('materialColors')} jsonPath="material_colors" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patchActiveDataframe((df) => {
                let key = ''
                while (df.materialColors[key] !== undefined) {
                  key += ' '
                }
                return { ...df, materialColors: { ...df.materialColors, [key]: '#000000' } }
              })
            }
          >
            + {t('color')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t('populateColorsHint')}
            onClick={() => patchActiveDataframe((df) => populateMaterialColorsForDataframe(df, includedLayerKeywords))}
          >
            {t('populateColors')}
          </Button>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => setShowGenerateColorsConfirm(true)}>
          {t('generateColors')}
        </Button>
      </div>

      {Object.entries(activeDataframe.materialColors).map(([material, color]) => {
        const isDefault = material === 'default'

        return (
          <div key={material} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <div className="flex items-center gap-2">
              {isDefault ? (
                <Input
                  value={material}
                  readOnly
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  className="w-full cursor-default text-zinc-900 dark:text-zinc-100"
                />
              ) : (
                <Select
                  className="w-full"
                  value={customMaterialNames[material] !== undefined ? CUSTOM_SELECT_VALUE : material}
                  onChange={(e) => {
                    const nextValue = e.target.value

                    if (nextValue === CUSTOM_SELECT_VALUE) {
                      setCustomMaterialNames((current) => ({ ...current, [material]: material }))
                      return
                    }

                    patchActiveDataframe((df) => {
                      const nextKey = nextValue.trim()
                      if (!nextKey || nextKey === material || df.materialColors[nextKey]) return df

                      const nextColors = Object.entries(df.materialColors).reduce<Record<string, string>>(
                        (acc, [key, value]) => {
                          acc[key === material ? nextKey : key] = value
                          return acc
                        },
                        {},
                      )

                      return { ...df, materialColors: nextColors }
                    })
                  }}
                >
                  <option value={material}>{material}</option>
                  {materialKeywordOptions.map((keyword) => (
                    <option key={keyword} value={keyword}>
                      {keyword}
                    </option>
                  ))}
                  <option value={CUSTOM_SELECT_VALUE}>{t('custom')}</option>
                </Select>
              )}

              {customMaterialNames[material] !== undefined ? (
                <Input
                  value={customMaterialNames[material]}
                  placeholder={t('customMaterialName')}
                  onChange={(event) => setCustomMaterialNames((current) => ({ ...current, [material]: event.target.value }))}
                  onBlur={() => {
                    patchActiveDataframe((df) => {
                      const draft = (customMaterialNames[material] ?? '').trim()
                      if (!draft || draft === material || df.materialColors[draft]) return df

                      const nextColors = Object.entries(df.materialColors).reduce<Record<string, string>>(
                        (acc, [key, value]) => {
                          acc[key === material ? draft : key] = value
                          return acc
                        },
                        {},
                      )

                      return { ...df, materialColors: nextColors }
                    })

                    setCustomMaterialNames((current) => {
                      const next = { ...current }
                      delete next[material]
                      return next
                    })
                  }}
                />
              ) : null}

              {!isDefault ? (
                <button
                  type="button"
                  className="rounded px-2 text-sm hover:bg-red-500 dark:hover:bg-zinc-700 aspect-square"
                  onClick={() =>
                    patchActiveDataframe((df) => {
                      const rest = Object.fromEntries(Object.entries(df.materialColors).filter(([key]) => key !== material))
                      return { ...df, materialColors: rest }
                    })
                  }
                  aria-label={t('removeNamed', { name: material })}
                >
                  ✕
                </button>
              ) : (
                <span aria-hidden="true" className="inline-block w-8" />
              )}
            </div>

            <Input
              type="color"
              value={HEX_COLOR.test(color) ? color : '#000000'}
              className="h-10 w-16 cursor-pointer rounded-md border border-zinc-300 p-1"
              onChange={(e) =>
                patchActiveDataframe((df) => ({
                  ...df,
                  materialColors: { ...df.materialColors, [material]: e.target.value },
                }))
              }
            />
            <Input
              value={color}
              onChange={(e) =>
                patchActiveDataframe((df) => ({
                  ...df,
                  materialColors: { ...df.materialColors, [material]: e.target.value },
                }))
              }
            />
          </div>
        )
      })}
    </section>
  )
}
