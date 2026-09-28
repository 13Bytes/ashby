import { useLayoutEffect, type RefObject } from 'react'

export type SectionStats = { defaults: number; essentials: number }

/**
 * Reports how many settings of a section are defaults and how many settings it shows in Simple
 * mode. Measured from the DOM because the fields of a
 * section are spread over several components; only top-level fields count (a field inside another
 * field is part of it). Runs after every render; `onStats` must ignore unchanged values.
 */
export function useSectionStats(ref: RefObject<HTMLElement | null>, onStats: (stats: SectionStats) => void) {
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const topLevel = (selector: string) =>
      [...element.querySelectorAll<HTMLElement>(selector)].filter((field) => !field.parentElement?.closest('[data-setting]'))
    const defaults = topLevel('[data-setting][data-level="default"]')
    onStats({
      defaults: defaults.length,
      // Visible in Simple mode: required/check fields and marked actions outside hidden default groups.
      essentials: topLevel('[data-setting][data-level="required"], [data-setting][data-level="check"], [data-always]')
        .filter((field) => !field.parentElement?.closest('[data-level="default"]')).length,
    })
  })
}
