import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const password = process.env.DISCLOSURE_ACCESS_PASSWORD;
if (!password || password.length < 32)
  throw Error(
    'A strong DISCLOSURE_ACCESS_PASSWORD is required; refusing public startup.',
  );
const hash = (value) => createHash('sha256').update(value).digest();
const expected = hash(`research:${password}`);
const root = await realpath(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'public'),
);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};
const server = http.createServer(async (req, res) => {
  // Everything, including JSON/assets, passes this gate. Nothing is CDN-public.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization, Accept-Encoding');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    const url = new URL(req.url, 'http://local.invalid');
    if (url.pathname === '/healthz' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    const header = req.headers.authorization || '';
    const credentials = /^Basic /i.test(header)
      ? Buffer.from(header.slice(6), 'base64').toString('utf8')
      : '';
    if (!timingSafeEqual(hash(credentials), expected)) {
      res.writeHead(401, {
        'WWW-Authenticate':
          'Basic realm="Disclosure Lab private research", charset="UTF-8"',
        'Content-Type': 'text/plain',
      });
      res.end(
        'Private research. Sign in with the credentials provided by the owner.',
      );
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (
      pathname.includes('\\') ||
      pathname.includes('\0') ||
      pathname.split('/').some((p) => p.startsWith('.') && p !== '')
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const candidate = path.resolve(
      root,
      `.${pathname === '/' ? '/index.html' : pathname}`,
    );
    const file = await realpath(candidate);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(file);
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', info.size);
      res.end();
      return;
    }
    const stream = createReadStream(file);
    const gzip =
      /\bgzip\b/.test(req.headers['accept-encoding'] || '') &&
      ['.html', '.js', '.css', '.json', '.svg'].includes(ext);
    const done = (err) => {
      if (err) res.destroy();
    };
    if (gzip) {
      res.setHeader('Content-Encoding', 'gzip');
      pipeline(stream, createGzip(), res, done);
    } else {
      res.setHeader('Content-Length', info.size);
      pipeline(stream, res, done);
    }
  } catch (error) {
    if (!res.headersSent)
      res.writeHead(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 400);
    res.end();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () =>
  console.log('Disclosure Lab private server ready'),
);
process.on('SIGTERM', () => server.close(() => process.exit(0)));
