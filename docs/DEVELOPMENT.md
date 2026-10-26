# Development

## Setup and commands

Use Node.js 24 (`nvm use` if installed) and npm. No Docker, shell-plugin tooling,
or browser is needed for automated checks.

```sh
npm ci
npm run check
```

- `npm run typecheck`: strict checks across runtime, build scripts, and tests.
- `npm run lint`: type-aware ESLint, including unsafe values and unhandled promises; warnings fail.
- `npm run format:check` / `npm run format`: check/apply Prettier formatting.
- `npm test`: build production files, validate the ZIP, and run controller regressions with Node's built-in test runner.
- `npm run build`: clean generated outputs, compile TypeScript, copy the manifest, and create the extension ZIP.

Dependencies are pinned and locked. Dependabot proposes weekly npm and GitHub
Actions updates. CI runs on pull requests and main pushes using Node 24 and
read-only repository permissions. Successful main runs upload a SHA-labelled
artifact with 30-day retention. Actions are pinned by commit; no signing key or
store account is required. Keep `manifest.json` and `package.json` versions aligned.

## Architecture

`src/background.ts` passes Chrome into the controller. `src/browser-api.ts`
defines the minimal typed capability boundary, checked against real Chrome at
compile time. `src/controller.ts` registers listeners synchronously, keeps a
serial promise queue, and moves eligible tab IDs with `windows.create`. See the
[Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
and [worker event requirements](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events).

The controller reads `storage.local.enabled` before moving; any value except
`false` means enabled, matching the recovered behavior. Badge updates, toggles,
and moves share a queue. `whenIdle()` is a test synchronization seam. The queue
is local to a worker and can disappear when MV3 stops it; event registration is
repeated on every wake, and no existing-tab sweep or pending-tab journal exists.
Split private workers share the preference but have independent queues.

After async reads, the controller checks that a tab still belongs to its source.
Disappearing tabs/windows are ignored during those reads. Unexpected errors and
failed final moves display **!**, and later events continue. Browser operations
are not atomic: user closure/dragging may still race with the final move.

TypeScript emits native ES modules for Chromium, rewriting `.ts` imports to
`.js`. There is no runtime dependency or bundler. `scripts/package.ts` uses a
development-only ZIP library and fixed timestamps/order for reproducible output.
Only compiled runtime files and the manifest enter `dist/` and the ZIP. Tests
assert archive contents, worker entry integrity, permission boundaries, and
matching versions. Build output stays ignored; the initial empty `test` file was
removed in favor of meaningful regression tests.

## Manual browser acceptance

Use a disposable Helium/Chromium profile. Record browser version, OS/compositor,
and outcomes. Do not change the user's profile or restart their shell for tests.

1. Build, load `dist/` unpacked, and confirm no manifest/worker errors and **ON**.
2. Create tabs with Ctrl+T and foreground links. Confirm each moves to a new
   normal window, retains page/form state, and requests expected focus.
3. Middle/Ctrl+click background links in focused and unfocused sources. Confirm
   destination focus behavior; on Wayland, record compositor policy differences.
4. Open a new browser window and popup/login window. Confirm their only tabs
   stay put, and popup windows remain excluded. Drag tabs between windows and
   confirm that attachment alone does not detach them again.
5. Pause and create several tabs. Resume, confirm old tabs stay, then create a
   new tab. Restart the browser while paused and confirm **OFF** persists.
6. Allow incognito, create private tabs, and confirm destinations remain private
   and pause changes propagate to both instances. Remove incognito permission.
7. Let the service worker stop (close its inspector), then create a tab and
   confirm handling resumes. Reload the extension with several existing tabs
   and confirm they remain together.
8. Test bursts, closing/dragging during detachment, session restoration,
   bookmark folders, pinned/grouped tabs, split views, and ordinary-tab login
   flows. Check that no tabs are lost; record unsupported cases explicitly.

Automated tests do not prove these live behaviors. There is no real-browser
automation dependency in this repo yet.
