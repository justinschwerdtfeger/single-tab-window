import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import ts from 'typescript';

void test('ships a complete MV3 extension with only storage permission', async () => {
  const root = new URL('../', import.meta.url);
  const files = unzipSync(
    await readFile(new URL('artifacts/single-tab-window.zip', root)),
  );
  assert.deepEqual(Object.keys(files).sort(), [
    'background.js',
    'browser-api.js',
    'controller.js',
    'manifest.json',
  ]);
  for (const [name, content] of Object.entries(files)) {
    assert.deepEqual(
      content,
      new Uint8Array(await readFile(new URL(`dist/${name}`, root))),
    );
  }
  const manifestBytes = files['manifest.json'];
  assert.ok(manifestBytes);
  const manifest: unknown = JSON.parse(strFromU8(manifestBytes));
  assert.partialDeepStrictEqual(manifest, {
    manifest_version: 3,
    permissions: ['storage'],
    incognito: 'split',
    background: { service_worker: 'background.js', type: 'module' },
  });
  assert.ok(manifest && typeof manifest === 'object');
  assert.ok('permissions' in manifest);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal('host_permissions' in manifest, false);
  assert.equal('content_scripts' in manifest, false);
  assert.equal('optional_permissions' in manifest, false);
  assert.equal('optional_host_permissions' in manifest, false);
  assert.ok('version' in manifest);
  const pkg: unknown = JSON.parse(
    await readFile(new URL('package.json', root), 'utf8'),
  );
  assert.ok(pkg && typeof pkg === 'object' && 'version' in pkg);
  assert.equal(manifest.version, pkg.version);

  // Every static module dependency must be local and present in the shipped ZIP.
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith('.js')) continue;
    const source = ts.createSourceFile(
      name,
      strFromU8(content),
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.JS,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      assert.ok(ts.isStringLiteral(statement.moduleSpecifier));
      const specifier = statement.moduleSpecifier.text;
      assert.ok(
        specifier.startsWith('./'),
        'no Node, remote, or bare runtime imports',
      );
      assert.ok(
        files[specifier.slice(2)],
        `missing runtime dependency: ${specifier}`,
      );
    }
  }
});
