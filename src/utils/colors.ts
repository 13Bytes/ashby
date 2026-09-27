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

export type Hsv = { h: number; s: number; v: number }

/** `#rrggbb` to hue (0–360), saturation and value (0–1). */
export const hexToHsv = (hex: string): Hsv => {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

export const hsvToHex = ({ h, s, v }: Hsv): string => {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return `#${[5, 3, 1].map((n) => channel(n).toString(16).padStart(2, '0')).join('')}`
}

/** Typed hex color (with or without `#`, 3 or 6 digits) as lowercase `#rrggbb`, or null. */
export const parseHexInput = (text: string): string | null => {
  const trimmed = text.trim()
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!HEX_COLOR.test(hex)) return null
  const digits = hex.slice(1).toLowerCase()
  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits}`
}
