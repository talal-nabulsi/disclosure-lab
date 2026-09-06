import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Profile metadata is deliberately separate from the verified backtest universe.
const revision = '464910341dbc9001387b3d5b96585bf1bc8c4e87';
const base = `https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/${revision}/public/data`;
const response = await fetch(`${base}/filers.json`);
if (!response.ok) throw Error(`Directory fetch failed: ${response.status}`);
const raw = await response.text();
const filers = JSON.parse(raw).filter((m) =>
  ['house', 'senate'].includes(m.chamber),
);
const replacements = {
  senate_alan_armstrong: {
    url: 'https://www.help.senate.gov/imo/media/image/Sen_Armstrong_official_photo.jpg',
    source: 'https://www.armstrong.senate.gov/about/',
  },
  house_johnjmr_mcguire_iii: {
    url: 'https://unitedstates.github.io/images/congress/225x275/M001239.jpg',
    source: 'https://clerk.house.gov/members/M001239/',
  },
  senate_timothyp_sheehy: {
    url: 'https://unitedstates.github.io/images/congress/225x275/S001232.jpg',
    source:
      'https://bioguideretro.congress.gov/Home/MemberDetails?memIndex=S001232',
  },
  senate_mmichael_rounds: {
    url: 'https://unitedstates.github.io/images/congress/225x275/R000605.jpg',
    source: 'https://www.rounds.senate.gov/about-mike',
  },
};
const disclosures = JSON.parse(
  await readFile(
    new URL('../public/data/disclosures.json', import.meta.url),
    'utf8',
  ),
);
const groups = new Map();
const correctionAudit = JSON.parse(
  await readFile(
    new URL('../public/data/portrait-corrections.json', import.meta.url),
    'utf8',
  ),
);
for (const m of filers) {
  const correction = correctionAudit.corrections.find((c) =>
    c.profileIds.includes(m.id),
  );
  const replacement = replacements[m.id];
  const photo = correction?.photo || replacement?.url || m.photo_url;
  const bioguide =
    correction?.bioguide || photo?.match(/\/([A-Z]\d{6})\.jpg$/)?.[1];
  const key = bioguide || m.id;
  const g = groups.get(key) || {
    id: key,
    name: correction?.name || m.full_name,
    photo,
    photoSource:
      correction?.photoSource ||
      replacement?.source ||
      'https://github.com/unitedstates/images',
    identityCorrections: [],
    chambers: [],
    states: [],
    parties: [],
    profiles: [],
    backtestMember: null,
    eligible: 0,
  };
  for (const [field, value] of [
    ['chambers', m.chamber],
    ['states', correction?.state || m.state],
    ['parties', correction?.party || m.party],
  ])
    if (value && !g[field].includes(value)) g[field].push(value);
  if (
    correction &&
    !g.identityCorrections.some((c) => c.reason === correction.reason)
  )
    g.identityCorrections.push({
      reason: correction.reason,
      source: correction.identitySource,
    });
  g.profiles.push({
    id: m.id,
    name: m.full_name,
    chamber: m.chamber,
    source: `${base}/filer/${m.id}.json`,
  });
  if (disclosures.members.some((x) => x.id === m.id)) {
    g.backtestMember = m.id;
    g.eligible = disclosures.trades.filter(
      (t) => t.member === m.id && !t.exclusion,
    ).length;
  }
  groups.set(key, g);
}
const members = [...groups.values()];
// Check actual image responses. No fabricated URLs/images or embedded portrait copies.
let cursor = 0;
const failures = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < members.length) {
      const m = members[cursor++];
      if (!m.photo) continue;
      try {
        const r = await fetch(m.photo, {
          method: 'HEAD',
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok || !r.headers.get('content-type')?.startsWith('image/'))
          throw Error(`HTTP ${r.status}`);
        m.photoVerified = true;
      } catch (e) {
        failures.push({ id: m.id, url: m.photo, reason: e.message });
        m.photo = null;
      }
    }
  }),
);
members.sort(
  (a, b) =>
    Number(Boolean(b.backtestMember)) - Number(Boolean(a.backtestMember)) ||
    a.name.localeCompare(b.name),
);
const manifest = {
  source: `${base}/filers.json`,
  revision,
  sourceSha256: createHash('sha256').update(raw).digest('hex'),
  generatedAt: new Date().toISOString(),
  sourceProfiles: filers.length,
  consolidatedProfiles: members.length,
  portraits: members.filter((m) => m.photo).length,
  failures,
  scope:
    'Historical congressional filer directory, not a current-member roster or complete trade database. Profiles sharing an upstream Bioguide portrait ID are grouped; cross-chamber histories and aliases remain linked. Backtest coverage is separate.',
};
await writeFile(
  new URL('../public/data/directory.json', import.meta.url),
  JSON.stringify({ manifest, members }, null, 2),
);
console.log(JSON.stringify(manifest, null, 2));
