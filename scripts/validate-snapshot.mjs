import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DEFAULT_CONFIG, runExperiment } from '../lib/backtest.ts';

const raw = await readFile(
  new URL('../public/data/snapshot.json', import.meta.url),
);
const s = JSON.parse(raw);
assert.equal(s.manifest.schemaVersion, 1);
assert.equal(
  new Set(s.trades.map((t) => t.id)).size,
  s.trades.length,
  'Duplicate record IDs',
);
for (const [ticker, history] of Object.entries(s.prices)) {
  assert.match(history.sha256, /^[a-f0-9]{64}$/);
  let last = '';
  for (const [date, open, close] of history.bars) {
    assert.ok(
      date > last && date <= s.manifest.asOf,
      `${ticker}: unsorted/duplicate/future date`,
    );
    assert.ok(
      Number.isFinite(open) && open > 0 && Number.isFinite(close) && close > 0,
      `${ticker}: invalid price`,
    );
    last = date;
  }
}
for (const t of s.trades.filter((t) => !t.exclusion)) {
  assert.equal(t.assetType, 'ST');
  assert.equal(t.type, 'Purchase');
  assert.ok(t.transactionDate <= t.filingDate);
  assert.match(t.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(
    t.source,
    /^https:\/\/disclosures-clerk.house.gov\/public_disc\/ptr-pdfs\/\d{4}\/\d+\.pdf$/,
  );
  assert.equal(s.prices[t.ticker].instrument, 'EQUITY');
  assert.equal(s.prices[t.ticker].currency, 'USD');
}
let experiments = 0;
for (const member of [...s.members.map((m) => m.id), 'all'])
  for (const benchmark of ['SPY', 'QQQ'])
    for (const holding of [5, 63, 252]) {
      const c = {
        ...DEFAULT_CONFIG,
        member,
        benchmark,
        holding,
        to: s.manifest.asOf,
      };
      const r = runExperiment(s, c);
      for (const [basis, scenario] of [
        ['transaction', r.transaction],
        ['disclosure', r.disclosure],
      ]) {
        assert.ok(
          scenario.curve.every(
            (p) => Number.isFinite(p.equity) && p.cash >= -1e-7,
          ),
        );
        const net = scenario.positions.reduce(
          (sum, p) => sum + p.pnl,
          c.capital,
        );
        assert.ok(
          Math.abs(net - scenario.finalEquity) < 1e-6,
          'Portfolio P&L must reconcile',
        );
        assert.equal(
          scenario.positions.length + scenario.skipped.length,
          r.selectedCount,
        );
        for (const p of scenario.positions)
          if (basis === 'disclosure')
            assert.ok(p.entryDate > p.trade.filingDate);
      }
      experiments++;
    }
const manifest = {
  snapshotSha256: createHash('sha256').update(raw).digest('hex'),
  ...s.manifest,
  records: s.trades.length,
  eligible: s.trades.filter((t) => !t.exclusion).length,
  priceSeries: Object.keys(s.prices).length,
  testedExperiments: experiments,
  members: s.members.map((m) => ({
    ...m,
    eligible: s.trades.filter((t) => t.member === m.id && !t.exclusion).length,
  })),
};
if (process.argv.includes('--record'))
  await writeFile(
    new URL('../public/data/provenance.json', import.meta.url),
    JSON.stringify(manifest, null, 2),
  );
console.log(JSON.stringify(manifest, null, 2));
