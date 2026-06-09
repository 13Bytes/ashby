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
