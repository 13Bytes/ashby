import type { ReactNode } from 'react'
import type { UILanguage } from '../uiTranslations'

export type FieldComponentProps = {
  label: string
  jsonPath: string
  selfClassName?: string
  className?: string
  language: UILanguage
  children: ReactNode
}

export type FieldComponent = (props: FieldComponentProps) => ReactNode
export type RemoveIconButtonComponent = (props: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) => ReactNode
export type ColorOrMaterialInputComponent = (props: { value: string; onChange: (next: string) => void; materialOptions: string[] }) => ReactNode
