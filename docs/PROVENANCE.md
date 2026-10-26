# Provenance

The controller, behavior documentation, and regression cases were recovered
from Justin's [justin-shell](https://github.com/justinschwerdtfeger/justin-shell)
repository:

- Addition: `cbd1dd11aa1d10c9288b23b6de6f9dbd5ecb536a`, **Add a Helium tab-detaching extension**, October 8, 2026.
- Source paths: `extensions/window-tabs/{background.js,controller.mjs,manifest.json,README.md}` and `tests/window-tabs-extension.test.cjs`.
- Removal: `3820c3988f81965c2d342c6ca46893864b16b1c8`, October 10, 2026.
- That removal's `docs/REVIEW.md` records that the optional extension broadened
  the shell repo's scope and was removed at the user's request. It was separate
  from TabCtl favicon support, which remained.

This repository restores the creation-only policy as **Single Tab Window**,
ports it and its browser simulation to strict TypeScript, and adds independent
validation and packaging. No justin-shell plugin code or TabCtl code is needed.

No explicit license was found in the recovered extension or the source repo's
file history. This restoration does not assign a new license. Tooling dependency
licenses remain with their respective packages; tooling is not shipped in the
extension archive.
