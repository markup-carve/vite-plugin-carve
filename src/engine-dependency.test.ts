import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// A `github:` or `git+` specifier installs fine here and breaks a consumer:
// npm hands them a spec that needs git and a build step. Main may pin a merged
// engine commit between releases, so the refusal lives in release.yml; these
// tests run the real guard on every pull request.
const guard = fileURLToPath(new URL('../scripts/no-git-dependencies.mjs', import.meta.url))
const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url))
const workflowPath = fileURLToPath(new URL('../.github/workflows/release.yml', import.meta.url))

type Manifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
const scratch = mkdtempSync(join(tmpdir(), 'vite-plugin-carve-guard-'))

function runGuard(path: string): { status: number | null; out: string } {
  const run = spawnSync(process.execPath, [guard, path], { encoding: 'utf8' })
  assert.equal(run.error, undefined, `spawning the guard failed: ${run.error}`)
  return { status: run.status, out: `${run.stdout}${run.stderr}` }
}

function runOn(candidate: Manifest, name: string): { status: number | null; out: string } {
  const path = join(scratch, `${name}.json`)
  writeFileSync(path, JSON.stringify(candidate, null, 2), 'utf8')
  return runGuard(path)
}

const withEngine = (spec: string): Manifest => ({
  ...manifest,
  dependencies: { ...manifest.dependencies, '@markup-carve/carve': spec },
})

const isGitSpec = (spec: string): boolean => /^(github|git\+[a-z]+|git):|\//.test(spec)

test('the engine is declared', () => {
  const spec = manifest.dependencies?.['@markup-carve/carve'] ?? manifest.devDependencies?.['@markup-carve/carve']
  assert.ok(spec, '@markup-carve/carve is not declared')
})

for (const [label, spec] of [
  ['a github: pin', 'github:markup-carve/carve-js#99ad0d2a4e5ec192440c3e5a1b4b95f50ed3cfcf'],
  ['a git+https:// pin', 'git+https://github.com/markup-carve/carve-js.git#99ad0d2'],
  ['a bare owner/repo#sha shorthand', 'markup-carve/carve-js#99ad0d2'],
] as const) {
  test(`the publish guard refuses ${label}`, () => {
    const { status, out } = runOn(withEngine(spec), 'git')
    assert.notEqual(status, 0, `the guard passed ${label}, which needs git at install time`)
    assert.ok(out.includes('dependencies.@markup-carve/carve'), `the report does not name the dependency:\n${out}`)
    assert.ok(out.includes(spec), `the report does not quote the spec:\n${out}`)
  })
}

test('the publish guard refuses a git spec in optionalDependencies', () => {
  const { status } = runOn(
    { ...withEngine('^0.1.16'), optionalDependencies: { tool: 'github:markup-carve/tool#abc123' } },
    'optional',
  )
  assert.notEqual(status, 0)
})

for (const spec of ['^0.1.16', '0.1.16', 'latest', 'npm:@markup-carve/carve@^0.1.16']) {
  test(`the publish guard accepts the registry spec ${spec}`, () => {
    const { status, out } = runOn(withEngine(spec), 'registry')
    assert.equal(status, 0, `the guard rejected ${spec}, which installs from the registry:\n${out}`)
  })
}

test('the publish guard leaves devDependencies alone', () => {
  const { status } = runOn(
    { ...withEngine('^0.1.16'), devDependencies: { ...manifest.devDependencies, x: 'github:someone/x#abc' } },
    'dev',
  )
  assert.equal(status, 0)
})

test('the publish guard gives the committed manifest the verdict a release would get', () => {
  const spec = manifest.dependencies?.['@markup-carve/carve'] ?? ''
  const { status, out } = runGuard(manifestPath)
  if (isGitSpec(spec)) {
    assert.notEqual(status, 0, `the committed git pin ${spec} would publish:\n${out}`)
  } else {
    assert.equal(status, 0, `the guard rejects the committed manifest:\n${out}`)
  }
})

test('release.yml runs the guard before the tag and the publish', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.ok(workflow.includes('node scripts/no-git-dependencies.mjs'), 'release.yml does not call the guard')
  for (const job of ['tag', 'publish']) {
    const block = workflow.split(new RegExp(`^  ${job}:\\n`, 'm'))[1]?.split(/^ {2}\S/m)[0] ?? ''
    assert.match(block, /needs: \[[^\]]*no-git-dependencies/, `the ${job} job does not wait for the guard`)
  }
})
