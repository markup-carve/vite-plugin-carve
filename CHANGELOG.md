# Changelog

Notable changes to `vite-plugin-carve`.

Rendering is done by the Carve engine (`@markup-carve/carve`), so an engine
change can alter output with no plugin diff. Engine bumps therefore get an
entry of their own.

## Unreleased

### Fixed

- `package.json` is importable, so the installed version can be read back
  (#10). The subpath was not in `exports`, so reading it threw
  `ERR_PACKAGE_PATH_NOT_EXPORTED` - which reads as the package being absent
  rather than the subpath being closed. Reachable through a git install
  already, not only at the first publish. Only that one file is opened; every
  other path stays refused.

## 0.1.0 - 2026-08-18

First release.

### Added

- Vite plugin importing `.crv` documents as rendered HTML modules. The default
  export is the HTML; `html` and `source` are named exports.
- Vite 5 and 6 are accepted as a peer dependency.

### Security

- Requires the Carve engine `@markup-carve/carve` >= 0.1.4 (`^0.1.4`). 0.1.4 is a
  security release: a list-valued URL attribute was only probed on its first
  entry, so `srcset="safe.png 1x, javascript:alert(1) 2x"` passed sanitization
  on the second one. Nothing published from this repo ever carried the older
  engine, so this is a floor rather than a fix for an installed version.
