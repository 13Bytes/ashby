export const normalizePlotLanguages = (existing: string[], next: string[]): string[] => {
  const normalized = [...new Set(next.map((entry) => entry.trim()).filter(Boolean))]
  return normalized.length > 0 ? normalized : existing.slice(0, 1)
}

export const addPlotLanguageToList = (existing: string[], language: string): string[] => {
  const trimmed = language.trim()
  if (!trimmed) return existing
  return existing.includes(trimmed) ? existing : [...existing, trimmed]
}
