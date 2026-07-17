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
export type IconButtonComponent = (props: { onClick: () => void; onHoverChange?: (hovered: boolean) => void }) => ReactNode
export type RemoveIconButtonComponent = IconButtonComponent
export type DuplicateIconButtonComponent = IconButtonComponent
export type ColorOrMaterialInputComponent = (props: { value: string; onChange: (next: string) => void; materialOptions: string[] }) => ReactNode
