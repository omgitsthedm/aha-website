import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 48379);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
const config = await readFile(resolve(root, '_headers'), 'utf8');
const headers = Object.fromEntries(
  config
    .split('\n\n')[0]
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
http
  .createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, headers);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      if (pathname.includes('\0')) throw new Error('Invalid path');
      let path = resolve(root, `.${pathname}`);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403, headers);
        res.end();
        return;
      }
      let status = 200;
      try {
        if ((await stat(path)).isDirectory())
          path = resolve(path, 'index.html');
        await stat(path);
      } catch {
        path = resolve(root, '404.html');
        status = 404;
      }
      const body = await readFile(path);
      const compressed =
        /gzip/.test(req.headers['accept-encoding'] || '') &&
        /\.(html|css|js|svg|json|txt|xml|webmanifest)$/.test(path);
      const payload = compressed ? gzipSync(body) : body;
      res.writeHead(status, {
        ...headers,
        'Content-Type': mime[extname(path)] || 'application/octet-stream',
        Vary: 'Accept-Encoding',
        'Content-Length': payload.length,
        ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
      });
      res.end(req.method === 'HEAD' ? undefined : payload);
    } catch {
      res.writeHead(400, headers);
      res.end('Bad request');
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`LFNYC static preview: http://127.0.0.1:${port}`),
  );
