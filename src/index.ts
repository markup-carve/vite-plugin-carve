import { realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve as resolvePath, sep } from 'node:path'
import {
  lint,
  renderWithDiagnostics,
  type Diagnostic,
  type IncludeAnswer,
  type IncludeConfig,
  type IncludeResolver,
  type LintOptions,
  type RenderOptions,
} from '@markup-carve/carve/v2'
import { fileSystemResolver } from '@markup-carve/carve/v2/node'
import type { Plugin } from 'vite'

export interface CarvePluginOptions {
  include?: RegExp
  /** Options of the Carve 0.2 HTML renderer. Include resolution is configured below. */
  render?: Omit<RenderOptions, 'includes'>
  /** Resolve include directives. Enabled for file-backed modules by default. */
  includes?: boolean
  /** Absolute include containment root. Defaults to Vite's project root. */
  includeRoot?: string
  /** Report Carve 0.2 lint findings as Vite warnings. Off by default. */
  lint?: boolean | CarveLintOptions
}

export interface CarveLintOptions {
  /** Also report advisory hint findings. */
  hints?: boolean
  /** Opt-in rules to run in addition to the defaults. */
  enabledRules?: readonly string[]
}

const DEFAULT_INCLUDE = /\.crv$/

function location(source: string | Uint8Array, offset: number): string {
  const bytes = typeof source === 'string' ? Buffer.from(source) : source
  const end = Math.min(Math.max(offset, 0), bytes.length)
  let start = 0
  let line = 1
  for (let at = 0; at < end; at++) {
    if (bytes[at] === 10) {
      line++
      start = at + 1
    }
  }
  const column = Array.from(new TextDecoder().decode(bytes.subarray(start, end))).length + 1
  return `line ${line}, column ${column}`
}

function warning(entry: Diagnostic, documentPath: string, root: string | undefined, sources: Map<string, string | Uint8Array>): string {
  const file = entry.file && root ? `${resolvePath(root, entry.file)}, ` : ''
  const source = entry.file ? sources.get(entry.file) : sources.get(documentPath)
  const at = entry.range && source !== undefined ? ` (${file}${location(source, entry.range.startOffset)})` : ''
  return `${entry.message} [${entry.code}]${at}`
}

function diagnosticKey(entry: Diagnostic): string {
  return `${entry.file ?? ''}\0${entry.code}\0${entry.range?.startOffset ?? ''}\0${entry.message}`
}

export default function carvePlugin(options: CarvePluginOptions = {}): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE
  let projectRoot: string | undefined

  return {
    name: 'vite-plugin-carve',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root
    },
    transform(source, id) {
      const [filename] = id.split('?', 1)
      if (!filename || !include.test(filename)) return null
      const documentPath = resolvePath(filename)
      const sources = new Map<string, string | Uint8Array>([[documentPath, source]])
      let includes: IncludeConfig | undefined
      let canonicalRoot: string | undefined
      if (options.includes ?? true) {
        const root = options.includeRoot ?? projectRoot ?? dirname(documentPath)
        if (!isAbsolute(root)) throw new Error('includeRoot must be an absolute path')
        const absoluteRoot = realpathSync(root)
        canonicalRoot = absoluteRoot
        const resolver = fileSystemResolver(absoluteRoot)
        const answers = new Map<string, IncludeAnswer>()
        const watched = new Set<string>()
        const recorded: IncludeResolver = (request) => {
          const key = JSON.stringify(request)
          let answer = answers.get(key)
          if (answer === undefined) {
            answer = resolver(request)
            answers.set(key, answer)
          }
          if ('text' in answer) {
            sources.set(answer.id, answer.text)
            const file = resolvePath(absoluteRoot, answer.id)
            if (!watched.has(file)) {
              watched.add(file)
              this.addWatchFile(file)
            }
          }
          return answer
        }
        includes = { resolver: recorded, file: relative(absoluteRoot, documentPath).split(sep).join('/') }
      }

      const renderOptions = options.render ?? {}
      const rendered = renderWithDiagnostics(source, { ...renderOptions, includes })
      const seen = new Set<string>()
      const report = (entry: Diagnostic) => {
        const key = diagnosticKey(entry)
        if (!seen.has(key)) {
          seen.add(key)
          this.warn(warning(entry, documentPath, canonicalRoot, sources))
        }
      }
      for (const entry of rendered.diagnostics) {
        report(entry)
      }
      if (rendered.suppressedDiagnostics) {
        this.warn(`${rendered.suppressedDiagnostics} include diagnostics were not reported`)
      }
      if (options.lint) {
        const selected = options.lint === true ? {} : options.lint
        const rules = Object.fromEntries((selected.enabledRules ?? []).map((name) => [name, 'on'])) as LintOptions['rules']
        for (const entry of lint(source, { includes, extensions: renderOptions.extensions, rules })) {
          if (entry.severity === 'hint' && !selected.hints) continue
          report(entry)
        }
      }
      const html = rendered.html
      return {
        code: [
          `export const source = ${JSON.stringify(source)};`,
          `export const html = ${JSON.stringify(html)};`,
          'export default html;',
          '',
        ].join('\n'),
        map: { mappings: '' },
      }
    },
  }
}

export { carvePlugin }
