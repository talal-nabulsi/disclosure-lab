import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const d = JSON.parse(
  readFileSync(
    new URL('../public/data/directory.json', import.meta.url),
    'utf8',
  ),
);
const disclosures = JSON.parse(
  readFileSync(
    new URL('../public/data/disclosures.json', import.meta.url),
    'utf8',
  ),
);
const person = (profile) =>
  d.members.find((m) => m.profiles.some((p) => p.id === profile));
test('directory preserves every upstream profile once while grouping aliases', () => {
  const profiles = d.members.flatMap((m) => m.profiles.map((p) => p.id));
  assert.equal(profiles.length, d.manifest.sourceProfiles);
  assert.equal(new Set(profiles).size, profiles.length);
  assert.equal(new Set(d.members.map((m) => m.id)).size, d.members.length);
  assert.ok(d.members.length > 300);
});
test('directory never implies unverified members have backtest data', () => {
  const ready = d.members.filter((m) => m.backtestMember);
  assert.equal(ready.length, disclosures.members.length);
  assert.equal(
    ready.reduce((n, m) => n + m.eligible, 0),
    disclosures.trades.filter((t) => !t.exclusion).length,
  );
  assert.ok(
    d.members.filter((m) => !m.backtestMember).every((m) => m.eligible === 0),
  );
});
test('portrait identity corrections do not regress to spouses or fathers', () => {
  assert.equal(person('house_aprilmcclain_delaney').id, 'M001232');
  assert.equal(person('house_michaela_collins').id, 'C001129');
  assert.equal(person('house_michaela_collins_jr').id, 'C001129');
  assert.equal(person('house_johnd_dingell').id, 'D000355');
  assert.deepEqual(person('house_elizabeth_fletcher').parties, ['D']);
  assert.deepEqual(person('house_elizabeth_fletcher').states, ['TX']);
  assert.deepEqual(person('house_cathymcmorris_rodgers').states, ['WA']);
});
test('unresolved identity has no guessed portrait, all available photos have sources', () => {
  assert.equal(person('senate_a_mitchell').photo, null);
  for (const m of d.members.filter((m) => m.photo)) {
    assert.match(m.photo, /^https:\/\//);
    assert.match(m.photoSource, /^https:\/\//);
    assert.equal(m.photoVerified, true);
  }
});
