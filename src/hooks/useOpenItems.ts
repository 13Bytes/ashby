import { useState } from 'react'

/** Moves every index from `from` on by `by`. */
const shift = (open: ReadonlySet<number>, from: number, by: number) =>
  new Set([...open].map((index) => (index < from ? index : index + by)))

/**
 * Which items of a list (axes, layers, areas, …) are expanded. New and duplicated items open,
 * indices follow inserts and removals, and everything closes when `resetKey` changes (another
 * dataframe or frame is shown).
 */
export function useOpenItems(resetKey: string) {
  const [state, setState] = useState<{ key: string; open: ReadonlySet<number> }>({ key: resetKey, open: new Set() })
  const open = state.key === resetKey ? state.open : new Set<number>()
  const update = (change: (current: ReadonlySet<number>) => ReadonlySet<number>) =>
    setState((current) => ({ key: resetKey, open: change(current.key === resetKey ? current.open : new Set()) }))

  return {
    isOpen: (index: number) => open.has(index),
    setOpen: (index: number, next: boolean) => update((current) => {
      const result = new Set(current)
      if (next) result.add(index)
      else result.delete(index)
      return result
    }),
    /** An item was appended at `index`: it opens. */
    added: (index: number) => update((current) => new Set([...current, index])),
    /** An item was inserted at `index` (e.g. a duplicate): later items move down, the new one opens. */
    inserted: (index: number) => update((current) => new Set([...shift(current, index, 1), index])),
    /** The item at `from` was moved to `to`: the items in between shift by one. */
    moved: (from: number, to: number) => update((current) => new Set([...current].map((index) =>
      index === from ? to : from < to && index > from && index <= to ? index - 1 : to < from && index >= to && index < from ? index + 1 : index))),
    /** The item at `index` was removed: later items move up. */
    removed: (index: number) => update((current) => shift(new Set([...current].filter((entry) => entry !== index)), index + 1, -1)),
  }
}
