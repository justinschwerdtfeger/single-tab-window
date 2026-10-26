# Single Tab Window

A small Chromium Manifest V3 extension that moves newly created tabs into their
own browser windows. This lets a desktop window switcher show each page separately.
It works independently of justin-shell, DMS, Niri, and TabCtl.

Restored from **Justin Window Tabs** in
[justin-shell commit cbd1dd1](https://github.com/justinschwerdtfeger/justin-shell/commit/cbd1dd11aa1d10c9288b23b6de6f9dbd5ecb536a),
then ported to strict TypeScript. The original was removed from justin-shell to
keep that repository focused on its shell plugins. See [provenance](docs/PROVENANCE.md).

## Install

Use Node.js 24 (see `.nvmrc`):

```sh
npm ci
npm run check
```

1. Open `chrome://extensions` in Helium or another Chromium browser.
2. Enable **Developer mode**, choose **Load unpacked**, and select this repo's `dist/` directory.
3. Pin **Single Tab Window** in the Extensions menu. Its badge starts at **ON**.
4. Click the toolbar button to pause (**OFF**) or resume. The setting survives browser restarts.
5. Optionally enable **Allow in incognito** in extension details. Private windows keep their private status, and the pause setting is shared.

After changing source files, run `npm run build`, then reload the extension on
`chrome://extensions`. Keep the loaded directory in place. Remove the extension
there to uninstall. Helium's **Dynamic** browser layout can hide the tab strip in
single-tab windows, where that setting is available.

## Builds from main

Successful pushes to `main` run all checks and upload a commit-labelled extension
ZIP to [GitHub Actions](https://github.com/justinschwerdtfeger/single-tab-window/actions/workflows/ci.yml).
Choose a successful **Validate and build** run and download its
`single-tab-window-<commit>` artifact (GitHub sign-in may be required). Extract the
download, then extract `single-tab-window.zip` into a permanent directory. Load
the directory containing `manifest.json` as unpacked. Artifacts are retained for
30 days; these are unsigned development builds with manual updates.

The same build is produced locally at `artifacts/single-tab-window.zip`, with an
unpacked copy at `dist/`. Pull requests run the same checks; main builds can also
be triggered manually from Actions. The workflow becomes active after it lands
on GitHub; this checkout does not publish an extension or store release.

## Behavior and limits

- Ctrl+T, Ctrl+click, middle-click, and other tab-creation actions are eligible.
  The existing tab moves by ID; its URL is never reopened and its page is never
  deliberately reloaded or closed.
- Existing tabs are left alone on install, startup, resume, and worker wake.
  Tabs already alone, popup/app/devtools windows, ordinary navigation, and
  manually dragging tabs between windows are left alone.
- Background tabs request unfocused windows. Foreground tabs request focus only
  while still active in a focused source window. Browser, compositor, and
  Wayland policies determine actual focus and placement.
- This reacts after creation: a tab-strip flash or transient focus change is
  possible. It is a best-effort creation policy, not a browser-enforced limit.
- Session restoration and opening bookmark folders may create many windows.
  Pause beforehand to keep those tabs together. Pinning, tab groups, and split
  views are not explicitly preserved. Login flows using ordinary tabs need live
  verification; login popups are excluded.
- API errors leave tabs under browser control and show a red **!** badge. Inspect
  the extension service-worker console for details. Clicking toggles the current
  pause state; toggling or reloading refreshes the badge. Events already queued
  before a pause click may finish first. There is no automatic retry after a
  failed move.

Only `storage` permission is requested. There are no content scripts, website
permissions, URL/content inspection, native services, network requests, or
telemetry. The [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
supports this tab management without the sensitive `tabs` permission.

## Development

See [development and manual checks](docs/DEVELOPMENT.md) and [agent guidance](AGENTS.md).
Automated checks exercise a simulated browser and the built package. Live Helium
installation, service-worker wakeups, restore/login flows, private windows, and
Niri/Wayland focus remain manual checks.
