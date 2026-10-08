import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type { Plugin } from 'vite'
import carvePlugin from './index.js'

async function render(plugin: Plugin, source: string, id: string, ctx: object = {}) {
  const hook = plugin.transform
  assert.ok(hook)
  const fn = typeof hook === 'function' ? hook : hook.handler
  const result = await fn.call({ addWatchFile() {}, warn() {}, ...ctx } as never, source, id)
  assert.ok(result && typeof result !== 'string')
  return result.code ?? ''
}

// Engine behavior the plugin's own code path reaches, and that no plugin diff
// would announce. Both of these changed between engine 0.1.7 and 0.1.10, and
// nothing here could see either one.

test('a case-only cross-reference stays literal instead of resolving', async () => {
  // Engine 0.1.7 resolved `</#alpha-beta>` against a heading whose id is
  // `Alpha-Beta`; 0.1.10 compares case exactly, so the reference degrades to
  // text. A consumer's page silently gains visible markup where a link was.
  const code = await render(carvePlugin(), '# Alpha Beta\n\n</#alpha-beta>\n', '/tmp/x.crv')

  assert.match(code, /&lt;\/#alpha-beta&gt;/)
  assert.doesNotMatch(code, /href=\\"#Alpha-Beta\\"/)
})

test('an exact cross-reference still resolves and clones the target text', async () => {
  const code = await render(carvePlugin(), '# Alpha Beta\n\n</#Alpha-Beta>\n', '/tmp/x.crv')

  assert.match(code, /href=\\"#Alpha-Beta\\">Alpha Beta/)
})

test('an include renames every colliding id, not only a heading id', async () => {
  // Engine 0.1.7 emitted three elements carrying id="dup" from one included
  // file, which is invalid HTML and makes the anchors collide. 0.1.10 renames
  // each later copy and reports every rename, so the plugin's warnings grow.
  const root = mkdtempSync(join(tmpdir(), 'vite-carve-collide-'))
  try {
    mkdirSync(join(root, 'pages'))
    writeFileSync(join(root, 'child.crv'), '{#sec}\n# Shared\n\n{#dup}\nA note.\n')
    const page = join(root, 'pages', 'index.crv')
    const warnings: string[] = []
    const code = await render(
      carvePlugin({ includeRoot: root }),
      '{#dup}\nBefore.\n\n{{ ../child.crv }}\n\n{{ ../child.crv }}\n',
      page,
      { warn: (message: string) => warnings.push(message) },
    )

    const ids = [...code.matchAll(/id=\\"([^\\"]+)\\"/g)].map((match) => match[1])
    assert.deepEqual(new Set(ids).size, ids.length, `duplicate ids emitted: ${ids.join(', ')}`)
    assert.ok(ids.includes('dup-2'), `expected a renamed id, got: ${ids.join(', ')}`)
    assert.deepEqual(warnings.filter((message) => /Id "dup" was renamed/.test(message)).length, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a blanked destination scheme reaches the Vite log', async () => {
  // The engine blanks `javascript:` either way; without the report the author
  // only sees a link that stopped working, with no position.
  for (const includes of [true, false]) {
    const warnings: string[] = []
    const code = await render(
      carvePlugin({ includes }),
      '[x](javascript:alert(1))\n',
      '/tmp/x.crv',
      { warn: (message: string) => warnings.push(message) },
    )

    assert.match(code, /href=\\"\\"/)
    assert.deepEqual(warnings, [
      'Blanked a denied destination scheme [destination-denied] (line 1, column 1)',
    ])
  }
})
