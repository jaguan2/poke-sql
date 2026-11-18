import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const webRoot = fileURLToPath(new URL('../', import.meta.url));

async function checkFile(directory, file, { sha512, size }) {
  if (!file || path.basename(file) !== file || file === '.' || file === '..' || file.includes('\\')) throw new Error(`Invalid release asset: ${file}`);
  const bytes = await readFile(path.join(directory, file));
  if (createHash('sha512').update(bytes).digest('base64') !== sha512 || (size !== undefined && bytes.length !== size)) {
    throw new Error(`Release asset checksum/size mismatch: ${file}`);
  }
  return bytes.length;
}

export async function verifyRelease(releaseDirectory, version) {
  const directory = path.join(releaseDirectory, 'nsis-web');
  const metadata = load(await readFile(path.join(directory, 'latest.yml'), 'utf8'));
  if (metadata.version !== version) throw new Error('Update metadata must match the application version.');
  const name = `PokeSQL-${version}-setup.exe`;
  if (metadata.files?.length !== 1 || metadata.files[0].url !== name || metadata.path !== name || metadata.sha512 !== metadata.files[0].sha512) {
    throw new Error('latest.yml must point to the small web installer only.');
  }
  const installerBytes = await checkFile(directory, name, metadata.files[0]);
  if (installerBytes > 10 * 1024 * 1024) throw new Error('The web installer unexpectedly exceeds 10 MiB.');
  const payload = metadata.packages?.x64;
  if (!payload?.path?.endsWith('.nsis.7z')) throw new Error('The x64 web-installer payload is missing.');
  const payloadBytes = await checkFile(directory, payload.path, payload);
  const portable = await stat(path.join(releaseDirectory, `PokeSQL-${version}-portable.exe`));
  if (portable.size < payloadBytes / 2) throw new Error('The offline portable application is incomplete.');
  return { installerBytes, payloadBytes, portableBytes: portable.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(await readFile(path.join(webRoot, 'package.json'), 'utf8'));
  if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== `v${pkg.version}`) throw new Error('The release tag must equal v + package.json version.');
  const directory = path.join(webRoot, 'release');
  const result = await verifyRelease(directory, pkg.version);
  const config = load(await readFile(path.join(directory, 'win-unpacked/resources/app-update.yml'), 'utf8'));
  const provider = pkg.build.publish[0];
  if (config.provider !== 'github' || config.owner !== provider.owner || config.repo !== provider.repo) {
    throw new Error('The packaged updater must use this repository’s GitHub Releases.');
  }
  console.log(`Verified release ${pkg.version}: ${JSON.stringify(result)}. Installer/payload SHA-512 hashes match latest.yml.`);
}
