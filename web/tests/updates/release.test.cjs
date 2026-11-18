const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { dump, load } = require('js-yaml');

test('release verification accepts matching assets and rejects an altered payload or wrong version', async () => {
  const { verifyRelease } = await import('../../scripts/check-release.mjs');
  const root = path.resolve(__dirname, '../..', 'test-results/release-verification');
  await mkdir(root, { recursive: true });
  const release = await mkdtemp(path.join(root, 'assets-'));
  const web = path.join(release, 'nsis-web'); await mkdir(web);
  const hash = text => createHash('sha512').update(text).digest('base64');
  await Promise.all([
    writeFile(path.join(web, 'PokeSQL-0.2.0-setup.exe'), 'setup'),
    writeFile(path.join(web, 'app.nsis.7z'), 'payload'),
    writeFile(path.join(release, 'PokeSQL-0.2.0-portable.exe'), 'portable'),
    writeFile(path.join(web, 'latest.yml'), dump({ version: '0.2.0', path: 'PokeSQL-0.2.0-setup.exe', sha512: hash('setup'),
      files: [{ url: 'PokeSQL-0.2.0-setup.exe', sha512: hash('setup'), size: 5 }],
      packages: { x64: { path: 'app.nsis.7z', sha512: hash('payload'), size: 7 } } })),
  ]);
  assert.deepEqual(await verifyRelease(release, '0.2.0'), { installerBytes: 5, payloadBytes: 7, portableBytes: 8 });
  await assert.rejects(verifyRelease(release, '0.2.1'), /metadata must match/);
  await writeFile(path.join(web, 'app.nsis.7z'), 'changed');
  await assert.rejects(verifyRelease(release, '0.2.0'), /checksum\/size mismatch/);
  const unsafe = load(await readFile(path.join(web, 'latest.yml'), 'utf8'));
  unsafe.packages.x64.path = '../app.nsis.7z';
  await writeFile(path.join(web, 'latest.yml'), dump(unsafe));
  await assert.rejects(verifyRelease(release, '0.2.0'), /Invalid release asset/);
});
