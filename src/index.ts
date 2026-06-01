import { carveToHtml, type RenderOptions, type ParseOptions } from '@markup-carve/carve'
import type { Plugin } from 'vite'

export interface CarvePluginOptions {
  include?: RegExp
  render?: ParseOptions & RenderOptions
}

const DEFAULT_INCLUDE = /\.(?:crv|carve)$/

export default function carvePlugin(options: CarvePluginOptions = {}): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE

  return {
    name: 'vite-plugin-carve',
    enforce: 'pre',
    transform(source, id) {
      const [filename] = id.split('?', 1)
      if (!filename || !include.test(filename)) return null

      const html = carveToHtml(source, options.render ?? {})
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
