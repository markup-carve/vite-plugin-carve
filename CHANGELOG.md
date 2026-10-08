# Changelog

Notable changes to `vite-plugin-carve`.

Rendering is done by the Carve engine (`@markup-carve/carve`), so an engine
change can alter output with no plugin diff. Engine bumps therefore get an
entry of their own.

## [Unreleased]

### Added

- A render loss the engine records is forwarded as a Vite warning carrying its
  code and source position. Rendering went through `renderDocument` and
  `carveToHtml`, which return a string and drop the report, so a blanked
  `javascript:` destination, a flattened ruby annotation or a raw block for
  another format left no trace in the build log.

### Fixed

- The published tarball no longer carries the compiled test files. `npm test`
  runs them out of `dist`, so `files: ["dist"]` shipped nine test, map and
  declaration files to every consumer, two thirds of the tarball, one of which
  spawns child processes. A packaging test reads `npm pack --dry-run` back.

### Changed

- Tested against `@markup-carve/carve` 0.1.10. The declared range `^0.1.7`
  already resolved it, but the committed lockfile held 0.1.7, so CI had never
  run the engine a consumer installs. Two engine behaviors the plugin's own
  transform reaches now have tests: a case-only cross-reference stays literal,
  and an include renames every colliding id rather than only a heading id.
  Renovate keeps the range and the lockfile moving from here.

## 0.1.1 - 2026-09-21

### Added

- `{{ path }}` include directives in imported `.crv` documents now expand,
  resolved relative to the document and contained to Vite's project root.
  `includes: false` leaves them literal, and `includeRoot` sets an absolute
  containment root (#18).

### Changed

- Requires `@markup-carve/carve` 0.1.7 (`^0.1.7`), the first release carrying
  contained include expansion (#20).

## 0.1.0 - 2026-08-18

First release.

### Added

- Vite plugin importing `.crv` documents as rendered HTML modules. The default
  export is the HTML; `html` and `source` are named exports.
- Vite 5 and 6 are accepted as a peer dependency.
- `package.json` is importable through `exports`, so the installed version can
  be read back (#10).

### Security

- Requires the Carve engine `@markup-carve/carve` >= 0.1.4 (`^0.1.4`). 0.1.4 is a
  security release: a list-valued URL attribute was only probed on its first
  entry, so `srcset="safe.png 1x, javascript:alert(1) 2x"` passed sanitization
  on the second one. Nothing published from this repo ever carried the older
  engine, so this is a floor rather than a fix for an installed version.
