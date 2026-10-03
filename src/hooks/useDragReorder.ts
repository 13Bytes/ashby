import { useState, type DragEvent, type HTMLAttributes, type KeyboardEvent } from 'react'

/** Where an item card shows the drop line while another item is dragged over it. */
export type DropIndicator = 'before' | 'after' | null

/** What an ItemCard needs to be reordered: props for its handle and itself, and the drop line. */
export type ItemDrag = {
  handle: HTMLAttributes<HTMLElement>
  item: HTMLAttributes<HTMLElement>
  indicator: DropIndicator
  dragging: boolean
}

/** The index an item at `from` ends up at when dropped before the item at `to` (to = length: at the end). */
export const finalIndex = (from: number, to: number) => (to > from ? to - 1 : to)

/**
 * Drag and drop for a list of item cards: dragged by their handle, dropped before or after another
 * card depending on which half the pointer is over. With the handle focused, ↑/↓ move by one.
 * `onMove(from, to)` gets the indices before and after the move.
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; to: number | null } | null>(null)
  const end = () => setDrag(null)
  // Where the dragged item would go; null while dropping would leave it in place.
  const target = drag && drag.to !== null && drag.to !== drag.from && drag.to !== drag.from + 1 ? drag.to : null

  return (index: number): ItemDrag => ({
    dragging: drag?.from === index,
    indicator: target === null ? null : target === index ? 'before' : target === count && index === count - 1 ? 'after' : null,
    handle: {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', '')
        const card = event.currentTarget.closest('[data-item-card]')
        if (card instanceof HTMLElement) event.dataTransfer.setDragImage(card, 16, 16)
        setDrag({ from: index, to: null })
      },
      onDragEnd: end,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
        if (to === null || to < 0 || to >= count) return
        event.preventDefault()
        onMove(index, to)
      },
    },
    item: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!drag) return     // something else is dragged (e.g. a plot tab)
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const rect = event.currentTarget.getBoundingClientRect()
        const to = index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0)
        if (to !== drag.to) setDrag({ ...drag, to })
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!drag) return
        event.preventDefault()
        if (target !== null) onMove(drag.from, finalIndex(drag.from, target))
        end()
      },
    },
  })
}
