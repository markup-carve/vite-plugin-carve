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
containment root.

## Development

Contributor setup, testing, and maintenance notes are in the [development guide](docs/development.md).
