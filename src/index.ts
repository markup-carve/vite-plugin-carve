import { dirname as dirnamePath, resolve as resolvePath } from 'node:path'
import {
  carveToHtmlWithReport,
  expandIncludes,
  lintCarve,
  parse,
  renderDocumentWithReport,
  resolve,
  type RenderOptions,
  type ParseOptions,
  type RenderResult,
  type LintWarning,
} from '@markup-carve/carve'
import { fileSystemResolver } from '@markup-carve/carve/node'
import type { Plugin } from 'vite'

export interface CarvePluginOptions {
  include?: RegExp
  render?: ParseOptions & RenderOptions
  /** Resolve `{{ path }}` directives. Enabled for file-backed modules by default. */
  includes?: boolean
  /** Include containment root. Defaults to Vite's project root. */
  includeRoot?: string
  /** Report `lintCarve` findings as Vite warnings. Off by default. */
  lint?: boolean
}

const DEFAULT_INCLUDE = /\.crv$/

/**
 * A render loss is the engine saying it dropped something the author wrote - a
 * blanked `javascript:` destination, a flattened ruby annotation, a raw block
 * for another format. Without this the output just quietly lacks it.
 */
function report(ctx: { warn: (message: string) => void }, result: RenderResult): string {
  for (const loss of result.losses) {
    const at = loss.pos ? ` (line ${loss.pos.startLine}, column ${loss.pos.startColumn})` : ''
    ctx.warn(`${loss.message} [${loss.code}]${at}`)
  }
  if (result.truncated) {
    ctx.warn(`${result.totalLosses} render losses in total; the rest were not reported`)
  }
  return result.value
}

function lintMessage(warning: LintWarning): string {
  const file = warning.file ? `${warning.file}, ` : ''
  return `${warning.message} [${warning.rule}] (${file}line ${warning.line}, column ${warning.column})`
}

export default function carvePlugin(options: CarvePluginOptions = {}): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE
  // Undefined until Vite resolves its config, so a transform that somehow runs
  // first falls back to the document's own directory rather than to the process
  // working directory, which I10 forbids as a containment root.
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

      let html: string
      const reported = new Set<string>()
      let lintIncludes: NonNullable<Parameters<typeof lintCarve>[1]>['includes']
      if (options.includes ?? true) {
        // A configured root reaches the resolver unchanged, so its absolute-path
        // refusal (PART 9 section 19, I10) still fires. Resolving it here would
        // root containment at the process working directory instead.
        const root = options.includeRoot ?? projectRoot ?? dirnamePath(resolvePath(filename))
        lintIncludes = { resolve: fileSystemResolver(root), sourcePath: resolvePath(filename) }
        const expanded = expandIncludes(parse(source, { ...options.render, positions: true }), source, {
          ...lintIncludes,
          extensions: options.render?.extensions,
        })
        for (const dependency of expanded.dependencies) {
          if (dependency.resolved) this.addWatchFile(dependency.id)
        }
        for (const warning of expanded.warnings) {
          reported.add(`${warning.rule}\0${warning.message}`)
          this.warn(warning.message)
        }
        html = report(this, renderDocumentWithReport(resolve(expanded.doc), options.render ?? {}))
      } else {
        html = report(this, carveToHtmlWithReport(source, options.render ?? {}))
      }
      if (options.lint) {
        const findings = lintCarve(source, { includes: lintIncludes, extensions: options.render?.extensions })
        // Include failures were already reported by the expansion above.
        for (const finding of findings) {
          if (!reported.has(`${finding.rule}\0${finding.message}`)) this.warn(lintMessage(finding))
        }
      }
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
