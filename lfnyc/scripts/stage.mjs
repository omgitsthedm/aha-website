import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';

const destination = process.argv[2];
if (!destination || !isAbsolute(destination)) {
  throw new Error(
    'Supply an absolute, task-owned staging directory outside the repository.',
  );
}
const source = fileURLToPath(new URL('../dist/', import.meta.url));
const repository = resolve(fileURLToPath(new URL('../../', import.meta.url)));
if (resolve(destination).startsWith(repository)) {
  throw new Error(
    'Stage outside the repository to avoid inheriting its commerce configuration.',
  );
}
const release = JSON.parse(
  await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'),
);
if (
  release.mode !== 'preview' ||
  release.siteId !== '275b4115-16bf-42fb-9b36-6bce9bb93608'
) {
  throw new Error('Only the exact-site preview artifact can be staged here.');
}
await mkdir(resolve(destination, 'functions-empty'), { recursive: true });
await cp(source, resolve(destination, 'dist'), { recursive: true });
await writeFile(
  resolve(destination, 'netlify.toml'),
  '[build]\n  publish = "dist"\n  functions = "functions-empty"\n[functions]\n  directory = "functions-empty"\n',
);
console.log(JSON.stringify({ staging: destination, ...release }, null, 2));
