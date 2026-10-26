# Agent guidance

Read `README.md` and `docs/DEVELOPMENT.md` before changing behavior or tooling.

## Scope and invariants

- This is a standalone Chromium Manifest V3 extension, restored from Justin's justin-shell extension. Keep shell plugins, native messaging, page inspection, telemetry, and desktop configuration out of scope.
- Move an existing tab by ID; never close it, reopen its URL, or reload it to recover from errors. Only newly created tabs in normal windows with siblings are eligible.
- Preserve background creation intent and the source's private status. Never sweep existing tabs on install, startup, resume, or worker wake. Manual tab attachment is outside the creation-only policy.
- Keep only the `storage` permission unless a feature explicitly needs another permission. Register event listeners synchronously on every worker evaluation.
- Serialize moves, recheck current tab/window state, and keep processing after API errors. In-memory state is temporary under MV3; only the enabled preference is persistent.

## Implementation

- Use strict TypeScript and the Chrome type definitions. Keep the small injected API in `src/browser-api.ts` assignable from real `chrome` without assertions. Maintain typed browser test doubles.
- Keep `src/background.ts` as the worker entry point and behavior in `src/controller.ts`. Use Node's built-in test runner; add behavioral regressions for meaningful policy changes.
- Do not add `any`, non-null assertions, `@ts-ignore`, broad lint disables, or weakened compiler settings to make a check pass. Narrow unknown values at JSON/storage boundaries.
- Use `.ts` relative imports; TypeScript rewrites them to `.js` for the extension. Runtime dependencies must not require Node or remote code.
- Keep manifest and package versions aligned. Commit `package-lock.json`; use `npm ci` for setup. Build outputs are generated and ignored.
- Do not edit `.agents/`, `.codex/`, `.aws/`, or user browser/desktop configuration during routine work.

## Validation and handoff

Run `npm run check` before handing off. It covers strict type checks, type-aware ESLint with zero warnings, Prettier, production compilation, archive checks, and behavioral tests. Run `git diff --check` too. Do not skip failing tools; report environment limits precisely.

Update behavior/installation/build documentation when contracts change. For browser-facing changes, use the manual checklist in `docs/DEVELOPMENT.md` in a disposable profile if available. Automated tests do not establish real Helium, session-restore, incognito, or Wayland focus compatibility. Do not install or reload the extension into the user's profile without authorization.
