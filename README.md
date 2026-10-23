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

File-backed modules expand `{{ path }}` directives by default. Paths resolve
relative to the document and cannot escape Vite's project root. Set
`includes: false` to leave directives literal, or set `includeRoot` to another
containment root, which must be an absolute path.

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

A missing or unpaired region is reported as a Vite warning, and included files
are watched for changes.

Render losses (a blanked `javascript:` link, a dropped raw block) are always
reported as Vite warnings. Set `lint: true` to also report the engine's lint
findings, such as a link to a fragment no heading defines or a reference link
with no definition. Findings in included files name that file:

```ts
carve({ lint: true })
```

The plugin needs `@markup-carve/carve` 0.1.13 or later.

## Development

Contributor setup, testing, and maintenance notes are in the [development guide](docs/development.md).
