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

test('includes only the named region of a file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vite-carve-region-'))
  try {
    writeFileSync(join(root, 'shared.crv'), 'Before.\n\n%% #region intro\nInside the region.\n%% #endregion\n\nAfter.\n')
    const warnings: string[] = []
    const plugin = carvePlugin({ includeRoot: root })
    const hook = plugin.transform
    assert.ok(hook)
    const fn = typeof hook === 'function' ? hook : hook.handler
    const result = await fn.call(
      { addWatchFile() {}, warn: (m: string) => warnings.push(m) } as never,
      '{{ shared.crv @region:intro }}',
      join(root, 'index.crv'),
    )
    assert.ok(result && typeof result !== 'string')
    assert.match(result.code ?? '', /Inside the region\./)
    assert.doesNotMatch(result.code ?? '', /Before\.|After\./)
    assert.deepEqual(warnings, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('includes a named region of a source file as a code block', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vite-carve-code-region-'))
  try {
    const file = join(root, 'example.ts')
    writeFileSync(file, 'import x from "y"\n// #region demo\nconst a = 1\n// #endregion\nexport {}\n')
    const watched: string[] = []
    const plugin = carvePlugin({ includeRoot: root })
    const hook = plugin.transform
    assert.ok(hook)
    const fn = typeof hook === 'function' ? hook : hook.handler
    const result = await fn.call(
      { addWatchFile: (f: string) => watched.push(f), warn() {} } as never,
      '{{ example.ts @region:demo @code:ts }}',
      join(root, 'index.crv'),
    )
    assert.ok(result && typeof result !== 'string')
    assert.match(result.code ?? '', /<pre><code class=\\"language-ts\\">const a = 1\\n<\/code><\/pre>/)
    assert.deepEqual(watched, [file])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

async function warningsFor(options: Parameters<typeof carvePlugin>[0], source: string, id: string) {
  const plugin = carvePlugin(options)
  const hook = plugin.transform
  assert.ok(hook)
  const fn = typeof hook === 'function' ? hook : hook.handler
  const warnings: string[] = []
  await fn.call({ addWatchFile() {}, warn: (m: string) => warnings.push(m) } as never, source, id)
  return warnings
}

test('reports lint findings as warnings when lint is enabled', async () => {
  const warnings = await warningsFor({ lint: true, includes: false }, 'See [x](#nope).\n', '/tmp/example.crv')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0] ?? '', /\[broken-fragment-link\] \(line 1, column 5\)$/)
})

test('does not lint by default', async () => {
  const warnings = await warningsFor({ includes: false }, 'See [x](#nope).\n', '/tmp/example.crv')
  assert.deepEqual(warnings, [])
})

test('lints included files and reports an include failure once', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vite-carve-lint-'))
  try {
    writeFileSync(join(root, 'shared.crv'), 'Bad [l](#zzz).\n')
    const warnings = await warningsFor({ lint: true, includeRoot: root }, '{{ shared.crv }}\n\n{{ missing.crv }}\n', join(root, 'index.crv'))
    assert.equal(warnings.filter((w) => w.includes('missing.crv')).length, 1)
    assert.ok(warnings.some((w) => w.includes('[broken-fragment-link]') && w.includes(join(root, 'shared.crv'))))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
