// Node module hooks that let tests import the frontend's TypeScript modules directly:
// `.ts` files are transpiled with the TypeScript compiler, and extensionless relative imports
// (as written for Vite) are resolved to `.ts`/`.tsx` files. Registered by register-ts.mjs.
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  if (isRelative && !HAS_EXTENSION.test(specifier) && context.parentURL?.endsWith('.ts')) {
    for (const extension of ['.ts', '.tsx']) {
      try {
        return await nextResolve(specifier + extension, context)
      } catch {
        // try the next extension
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context)
  const source = await readFile(new URL(url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: url,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
  })
  return { format: 'module', source: outputText, shortCircuit: true }
}
