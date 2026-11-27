# vite-plugin-carve

Vite plugin for importing `.crv` documents as rendered HTML.

```ts
import { defineConfig } from 'vite'
import carve from '@markup-carve/vite-plugin-carve'

export default defineConfig({
  plugins: [carve()],
})
```

```ts
import html, { source } from './intro.crv'
```

The default export is rendered HTML. Named exports:

- `html`
- `source`

The `main` branch uses the unreleased Carve 0.2 engine. The import path and
the `html` and `source` exports stay the same. The engine is pinned to one
commit of its `main` branch, so installing this branch needs git and builds
the engine from that commit.

File-backed modules expand `{{ path }}` directives by default. Paths resolve
relative to the document and cannot escape Vite's project root. Set
`includes: false` to leave directives literal and report the unresolved include,
or set `includeRoot` to another containment root, which must be an absolute path.

A directive can take one named region of a file instead of the whole file:

```text
{{ shared.crv @region:intro }}
```

The region is the lines between `%% #region intro` and `%% #endregion` in the
included file. A source file can be included as a code block, and its region
markers can use the file's own comment syntax:

```text
{{ src/example.ts @region:demo @code:ts }}
```

```ts
// #region demo
const answer = 42
// #endregion
```

A CSV or TSV file included as a table can select records with `@rows` and
columns with `@cols`. The header row is kept:

```text
{table}
{{ data.csv @code:csv @rows:3-4 @cols:"Seats,Plan" }}
```

A missing or unpaired region is reported as a Vite warning, and included files
are watched for changes.

Carve 0.2 parse diagnostics and render losses (a blanked `javascript:` link,
for example) are reported as Vite warnings. Set `lint: true` to also report
lint findings. Findings in included files name that file:

```ts
carve({ lint: true })
```

Advisory `Hint` findings are left out. Set `hints: true` to report them.
Carve 0.2 keeps migration notices such as `thematic-break-spelling` off by
default; set `upgrade: true` to include them:

```ts
carve({ lint: { hints: true, upgrade: true } })
```

A `%% carve-lint-disable-next-line <rule>` comment in the document silences a
finding. Use `render` to pass Carve 0.2 HTML options. For example:

```ts
carve({ render: { sections: true, mode: 'static', rawHtml: false } })
```

The engine's default URL policy denies unsafe schemes. Raw HTML remains off
unless `render.rawHtml` is set to `true`.

The 0.1 `render` option names are no longer accepted. Use the 0.2 names such
as `sections`, `mode`, `rawHtml`, `urlPolicy`, `headingIds`, `extensions`, and
`renderers`. The extension surface is provisional in the engine.

## Development

Contributor setup, testing, and maintenance notes are in the [development guide](docs/development.md).
