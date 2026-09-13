import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, '.firebase-disclosure');
const snapshot = JSON.parse(
  await readFile(path.join(root, 'public/data/snapshot.json'), 'utf8'),
);
if (!snapshot.prices?.SPY || !snapshot.trades?.length)
  throw Error('A real, validated research snapshot is required.');
await build({
  configFile: false,
  root: path.join(root, 'firebase/client'),
  publicDir: false,
  plugins: [react()],
  css: { postcss: { plugins: [tailwind()] } },
  resolve: {
    alias: {
      '@': root,
      'next/link': path.join(root, 'firebase/client/link.tsx'),
    },
  },
  build: {
    outDir: path.join(stage, 'public'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
await mkdir(path.join(stage, 'public/data'), { recursive: true });
for (const name of [
  'snapshot.json',
  'directory.json',
  'disclosures.json',
  'provenance.json',
  'portrait-corrections.json',
])
  await copyFile(
    path.join(root, 'public/data', name),
    path.join(stage, 'public/data', name),
  );
for (const name of ['favicon.svg', 'og.png'])
  await copyFile(
    path.join(root, 'public', name),
    path.join(stage, 'public', name),
  );
for (const name of ['server.mjs', 'apphosting.yaml', 'firebase.json'])
  await copyFile(path.join(root, 'firebase', name), path.join(stage, name));
await copyFile(
  path.join(root, 'firebase/runtime-package.json'),
  path.join(stage, 'package.json'),
);
const pkg = JSON.parse(
  await readFile(path.join(stage, 'package.json'), 'utf8'),
);
await writeFile(
  path.join(stage, 'package-lock.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      lockfileVersion: 3,
      requires: true,
      packages: { '': pkg },
    },
    null,
    2,
  ),
);
console.log(
  'Prepared isolated Firebase deployment: compiled UI, protected data, zero-dependency server. No local credentials or research caches included.',
);
