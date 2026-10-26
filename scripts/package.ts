import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { zipSync } from 'fflate';

const root = new URL('../', import.meta.url);
const manifestText = await readFile(new URL('manifest.json', root), 'utf8');
const manifest: unknown = JSON.parse(manifestText);
const pkg: unknown = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8'),
);
assert.ok(manifest && typeof manifest === 'object' && 'version' in manifest);
assert.ok(pkg && typeof pkg === 'object' && 'version' in pkg);
assert.equal(
  manifest.version,
  pkg.version,
  'Manifest/package versions must match',
);

await copyFile(
  new URL('manifest.json', root),
  new URL('dist/manifest.json', root),
);
const files: Record<string, Uint8Array> = {};
for (const name of (await readdir(new URL('dist/', root))).sort()) {
  files[name] = await readFile(new URL(`dist/${name}`, root));
}
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(
  new URL('artifacts/single-tab-window.zip', root),
  // ZIP stores local wall-clock components without a time zone. Construct this
  // as local midnight so developers and CI encode the same DOS timestamp.
  zipSync(files, { level: 9, mtime: new Date(2020, 0, 1, 0, 0, 0) }),
);
console.log('Built dist/ and artifacts/single-tab-window.zip');
