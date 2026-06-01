export type UIThemePreference = 'system' | 'light' | 'dark'
export type ResolvedUITheme = 'light' | 'dark'

export const UI_THEME_STORAGE_KEY = 'ashby-ui-theme'
export const UI_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function parseUIThemePreference(value: string | null): UIThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveUITheme(preference: UIThemePreference, systemPrefersDark: boolean): ResolvedUITheme {
  return preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference
}

export function readStoredUITheme(storage: Pick<Storage, 'getItem'> = window.localStorage): UIThemePreference {
  return parseUIThemePreference(storage.getItem(UI_THEME_STORAGE_KEY))
}

export function applyUITheme(
  preference: UIThemePreference,
  html = document.documentElement,
  systemPrefersDark = window.matchMedia(UI_THEME_MEDIA_QUERY).matches,
) {
  const theme = resolveUITheme(preference, systemPrefersDark)
  html.classList.toggle('dark', theme === 'dark')
  html.style.colorScheme = theme
}

export function subscribeToSystemTheme(
  onChange: (systemPrefersDark: boolean) => void,
  mediaQuery = window.matchMedia(UI_THEME_MEDIA_QUERY),
) {
  const handleChange = (event: MediaQueryListEvent) => onChange(event.matches)
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
