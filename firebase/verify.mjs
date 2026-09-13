import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';

const secret = randomBytes(32).toString('base64url');
const server = spawn(process.execPath, ['.firebase-disclosure/server.mjs'], {
  env: { ...process.env, PORT: '8087', DISCLOSURE_ACCESS_PASSWORD: secret },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const timeout = setTimeout(() => server.kill(), 15000);
try {
  await once(server.stdout, 'data');
  const base = 'http://127.0.0.1:8087';
  const headers = {
    Authorization: `Basic ${Buffer.from(`research:${secret}`).toString('base64')}`,
  };
  for (const route of ['/', '/data/snapshot.json', '/data/disclosures.json']) {
    const denied = await fetch(base + route);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('cache-control'), /no-store/);
  }
  assert.equal(
    (await fetch(base + '/', { headers: { Authorization: 'Basic d3Jvbmc=' } }))
      .status,
    401,
  );
  const page = await fetch(base + '/', { headers });
  assert.equal(page.status, 200);
  const html = await page.text();
  const js = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(base + js)).status, 401);
  assert.equal((await fetch(base + js, { headers })).status, 200);
  const data = await fetch(base + '/data/snapshot.json', { headers });
  assert.equal(data.status, 200);
  assert.match(data.headers.get('cache-control'), /no-store/);
  const bytes = Buffer.from(await data.arrayBuffer());
  const original = await readFile('public/data/snapshot.json');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(original).digest('hex'),
  );
  assert.equal((await fetch(base + '/.env', { headers })).status, 404);
  assert.equal((await fetch(base + '/package.json', { headers })).status, 404);
  assert.equal(
    (await fetch(base + '/', { headers, method: 'POST' })).status,
    405,
  );
  console.log(
    'Verified: credentials required for HTML/JS/data; wrong credentials rejected; no-store caching; exact snapshot served; source files inaccessible.',
  );
} finally {
  clearTimeout(timeout);
  server.kill();
}
