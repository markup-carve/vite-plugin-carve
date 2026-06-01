import assert from 'node:assert/strict'
import test from 'node:test'
import type { Plugin } from 'vite'
import carvePlugin from './index.js'

async function transform(plugin: Plugin, source: string, id: string) {
  const hook = plugin.transform
  assert.ok(hook)
  const fn = typeof hook === 'function' ? hook : hook.handler
  return fn.call({} as never, source, id)
}

test('renders crv modules to html exports', async () => {
  const plugin = carvePlugin()
  const result = await transform(plugin, '# Hello', '/tmp/example.crv')
  assert.ok(result && typeof result !== 'string')
  assert.ok(result.code)
  assert.match(result.code, /<h1>Hello<\/h1>/)
  assert.match(result.code, /export default html/)
})

test('ignores non-carve modules', async () => {
  const plugin = carvePlugin()
  const result = await transform(plugin, '# Hello', '/tmp/example.md')
  assert.equal(result, null)
})
