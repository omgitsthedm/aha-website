// Cache editorial photographs by their actual bytes. Source URLs stay available
// for feeds and older links; only content-addressed copies receive immutable cache.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const photos = [await read('src/data/photography.json'), await read('src/data/images.json')];
const avif = await read('src/data/avif.json');
const sources = new Set();
const visit = value => {
  if (typeof value === 'string') for (const match of value.matchAll(/\/images\/[^\s,"<>]+\.(?:webp|avif|jpe?g|png)/g)) sources.add(match[0]);
  else if (Array.isArray(value)) value.forEach(visit);
  else if (value && typeof value === 'object') Object.values(value).forEach(visit);
};
photos.forEach(visit);
for (const path of [...sources]) if (avif[path]) visit(avif[path]);
const map = {};
await mkdir(new URL('public/images/immutable/', root), { recursive: true });
for (const source of [...sources].sort()) {
  const file = new URL(`public${source}`, root);
  const bytes = await readFile(file);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
  const target = `/images/immutable/${hash}.${source.split('.').at(-1)}`;
  await copyFile(file, new URL(`public${target}`, root));
  map[source] = target;
}
await writeFile(new URL('src/data/image-versions.json', root), `${JSON.stringify(map, null, 2)}\n`);
console.log(`Prepared ${Object.keys(map).length} content-versioned editorial images without recompression.`);
