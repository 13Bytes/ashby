/** Matches the 3- and 6-digit hex colors the custom color input accepts. */
export const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const isCssColor = (value: string): boolean =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports('color', value) : HEX_COLOR.test(value)

/**
 * Color to preview for a color reference: a material name resolves to its material color (one
 * level, like the backend), everything else is used as is. Matplotlib's basic color names are
 * valid CSS color names, so they preview correctly. Returns undefined when nothing can be shown.
 */
export function resolvePreviewColor(value: string | undefined, materialColors: Record<string, string>): string | undefined {
  const reference = value?.trim()
  if (!reference) return undefined
  const resolved = (materialColors[reference] ?? reference).trim()
  return resolved && isCssColor(resolved) ? resolved : undefined
}
