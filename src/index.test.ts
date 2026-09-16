import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('expands contained includes and watches their files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vite-carve-includes-'))
  try {
    const page = join(root, 'pages', 'index.crv')
    const child = join(root, 'shared.crv')
    mkdirSync(join(root, 'pages'))
    writeFileSync(child, 'Included text.')
    const plugin = carvePlugin({ includeRoot: root })
    const watched: string[] = []
    const hook = plugin.transform
    assert.ok(hook)
    const fn = typeof hook === 'function' ? hook : hook.handler
    const result = await fn.call({ addWatchFile: (file: string) => watched.push(file), warn() {} } as never, '{{ ../shared.crv }}', page)
    assert.ok(result && typeof result !== 'string')
    assert.match(result.code ?? '', /Included text\./)
    assert.deepEqual(watched, [child])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('refuses a relative include root instead of rooting it at the cwd', async () => {
  const plugin = carvePlugin({ includeRoot: '..' })
  const hook = plugin.transform
  assert.ok(hook)
  const fn = typeof hook === 'function' ? hook : hook.handler
  await assert.rejects(
    async () => fn.call({ addWatchFile() {}, warn() {} } as never, '{{ shared.crv }}', '/tmp/pages/index.crv'),
    /absolute path/,
  )
})
