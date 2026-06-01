# vite-plugin-carve

Vite plugin for importing `.crv` and `.carve` documents as rendered HTML.

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

## Development

```bash
npm install
npm run build
npm test
```
