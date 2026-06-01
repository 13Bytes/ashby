const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

type TokenMode = 'plain' | 'string' | 'number' | 'keyword'

const pushToken = (buffer: string, mode: TokenMode) => {
  if (!buffer) return ''
  if (mode === 'string') return `<span class="text-emerald-700 dark:text-emerald-400">${escapeHtml(buffer)}</span>`
  if (mode === 'number') return `<span class="text-sky-700 dark:text-sky-400">${escapeHtml(buffer)}</span>`
  if (mode === 'keyword') return `<span class="text-fuchsia-700 dark:text-fuchsia-400">${escapeHtml(buffer)}</span>`
  return escapeHtml(buffer)
}

export const getJsonSyntaxMarkers = (jsonDraft: string): Set<number> => {
  const stack: Array<{ char: string; index: number }> = []
  const unmatched = new Set<number>()
  let inString = false
  let escaped = false
  let stringStartIndex = -1

  for (let index = 0; index < jsonDraft.length; index += 1) {
    const char = jsonDraft[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
        stringStartIndex = -1
      }
      continue
    }
    if (char === '"') {
      inString = true
      stringStartIndex = index
      continue
    }
    if (char === '{' || char === '[') {
      stack.push({ char, index })
    } else if (char === '}' || char === ']') {
      const last = stack[stack.length - 1]
      if (!last) {
        unmatched.add(index)
        continue
      }
      const validPair = (last.char === '{' && char === '}') || (last.char === '[' && char === ']')
      if (validPair) {
        stack.pop()
      } else {
        unmatched.add(last.index)
        unmatched.add(index)
        stack.pop()
      }
    }
  }

  stack.forEach((entry) => unmatched.add(entry.index))
  if (inString && stringStartIndex >= 0) {
    unmatched.add(stringStartIndex)
  }
  return unmatched
}

export const highlightJson = (jsonDraft: string, jsonMarker: Set<number>): string => {
  let output = ''
  let buffer = ''
  let mode: TokenMode = 'plain'
  let escaped = false

  for (let index = 0; index < jsonDraft.length; index += 1) {
    const char = jsonDraft[index]

    if (jsonMarker.has(index) && ['{', '}', '[', ']', '"', "'"].includes(char)) {
      output += pushToken(buffer, mode)
      buffer = ''
      mode = 'plain'
      output += `<span class="rounded bg-red-500/20 text-red-300">${escapeHtml(char)}</span>`
      continue
    }

    if (mode === 'string') {
      buffer += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        output += pushToken(buffer, mode)
        buffer = ''
        mode = 'plain'
      }
      continue
    }

    if (char === '"') {
      output += pushToken(buffer, mode)
      buffer = '"'
      mode = 'string'
      continue
    }

    if (/[[\]{}:,]/.test(char)) {
      output += pushToken(buffer, mode)
      buffer = ''
      mode = 'plain'
      output += `<span class="text-zinc-400">${escapeHtml(char)}</span>`
      continue
    }

    if (char === '\n' || char === ' ' || char === '\t') {
      output += pushToken(buffer, mode)
      buffer = ''
      mode = 'plain'
      output += char === '\n' ? '\n' : char === '\t' ? '  ' : ' '
      continue
    }

    if (mode === 'plain') {
      buffer = char
      mode = /[0-9-]/.test(char) ? 'number' : /[A-Za-z]/.test(char) ? 'keyword' : 'plain'
    } else {
      buffer += char
    }
  }

  output += pushToken(buffer, mode)
  return output
}
