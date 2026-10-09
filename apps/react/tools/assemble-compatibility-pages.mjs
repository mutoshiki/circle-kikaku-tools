#!/usr/bin/env node
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;

function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function readManifest(directory, description) {
  const manifestPath = path.join(directory, 'release-build.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`${description} has a missing or invalid release-build.json`, { cause: error });
  }
  if (!shaPattern.test(manifest?.sourceSha || '') || !digestPattern.test(manifest?.assetDigest || '')) {
    throw new Error(`${description} release manifest has an invalid source SHA or asset digest`);
  }
  return manifest;
}

async function requireFile(directory, filename, description) {
  let details;
  try {
    details = await lstat(path.join(directory, filename));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${description} is missing ${filename}`, { cause: error });
    throw error;
  }
  if (!details.isFile()) throw new Error(`${description} is missing ${filename}`);
}

async function copyDirectoryContents(source, destination, { skipRootNames = new Set() } = {}) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    if (skipRootNames.has(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const details = await lstat(sourcePath);
    if (details.isDirectory()) {
      await copyDirectoryContents(sourcePath, destinationPath);
    } else if (details.isFile()) {
      await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
    } else {
      throw new Error(`unsupported symbolic link or special file in Pages input: ${sourcePath}`);
    }
  }
}

export async function assembleCompatibilityPages({ preservedPagesDirectory, reactBuildDirectory, legacyDirectory, outputDirectory }) {
  const sources = [
    ['preserved Pages', preservedPagesDirectory],
    ['React build', reactBuildDirectory],
    ['pinned legacy build', legacyDirectory],
  ];
  if (sources.some(([, directory]) => typeof directory !== 'string' || !directory)) {
    throw new Error('all three Pages input directories are required');
  }
  if (typeof outputDirectory !== 'string' || !outputDirectory) throw new Error('output directory is required');

  const resolvedSources = await Promise.all(sources.map(async ([description, directory]) => {
    const resolved = await realpath(directory);
    const details = await lstat(resolved);
    if (!details.isDirectory()) throw new Error(`${description} input must be a directory`);
    return { description, path: resolved };
  }));

  for (let left = 0; left < resolvedSources.length; left += 1) {
    for (let right = left + 1; right < resolvedSources.length; right += 1) {
      const a = resolvedSources[left];
      const b = resolvedSources[right];
      if (containsPath(a.path, b.path) || containsPath(b.path, a.path)) {
        throw new Error('input directories must be disjoint');
      }
    }
  }

  const outputPath = path.resolve(outputDirectory);
  const outputParent = await realpath(path.dirname(outputPath));
  const resolvedOutput = path.join(outputParent, path.basename(outputPath));
  if (resolvedSources.some(source => containsPath(source.path, resolvedOutput) || containsPath(resolvedOutput, source.path))) {
    throw new Error('output directory must be disjoint from all input directories');
  }
  try {
    await lstat(resolvedOutput);
    throw new Error('output directory already exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const preservedPath = resolvedSources[0].path;
  const reactPath = resolvedSources[1].path;
  const legacyPath = resolvedSources[2].path;
  await requireFile(preservedPath, 'index.html', 'preserved Pages root');
  await requireFile(preservedPath, 'release-build.json', 'preserved Pages root');
  await requireFile(preservedPath, '.nojekyll', 'preserved Pages root');
  await requireFile(reactPath, 'index.html', 'React build');
  await requireFile(reactPath, 'release-build.json', 'React build');
  await requireFile(legacyPath, 'index.html', 'pinned legacy build');
  const rootManifest = await readManifest(preservedPath, 'preserved Pages root');
  const reactManifest = await readManifest(reactPath, 'React build');

  let outputCreated = false;
  try {
    await mkdir(resolvedOutput);
    outputCreated = true;
    await copyDirectoryContents(preservedPath, resolvedOutput, { skipRootNames: new Set(['react', 'legacy']) });
    await copyDirectoryContents(reactPath, path.join(resolvedOutput, 'react'));
    await copyDirectoryContents(legacyPath, path.join(resolvedOutput, 'legacy'));
    return { rootManifest, reactManifest };
  } catch (error) {
    if (outputCreated) await rm(resolvedOutput, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [preservedPagesDirectory, reactBuildDirectory, legacyDirectory, outputDirectory, ...extra] = process.argv.slice(2);
    if (!preservedPagesDirectory || !reactBuildDirectory || !legacyDirectory || !outputDirectory || extra.length) {
      throw new Error('usage: assemble-compatibility-pages <preserved-pages> <react-build> <pinned-legacy> <new-output>');
    }
    const result = await assembleCompatibilityPages({ preservedPagesDirectory, reactBuildDirectory, legacyDirectory, outputDirectory });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
