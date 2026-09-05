import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  simulate,
  runExperiment,
  validateConfig,
} from '../lib/backtest.ts';

const dates = [
  '2024-01-05',
  '2024-01-08',
  '2024-01-09',
  '2024-01-10',
  '2024-01-11',
];
function fixture(overrides = {}) {
  const trade = {
    id: 'a',
    member: 'm',
    ticker: 'ABC',
    asset: 'ABC',
    type: 'Purchase',
    assetType: 'ST',
    transactionDate: dates[0],
    filingDate: '2024-01-06',
    owner: 'SP',
    amountLow: 1001,
    amountHigh: 15000,
    amountLabel: 'range',
    description: '',
    source: 'https://example.com',
    verification: 'fixture',
    exclusion: null,
    ...overrides,
  };
  const s = {
    trades: [trade],
    prices: {
      ABC: { bars: dates.map((d, i) => [d, 100 + i * 10, 105 + i * 10]) },
      SPY: { bars: dates.map((d) => [d, 100, 100]) },
    },
  };
  const c = {
    ...DEFAULT_CONFIG,
    member: 'm',
    from: dates[0],
    to: dates.at(-1),
    capital: 1000,
    allocation: 100,
    holding: 2,
    costBps: 0,
  };
  return { s, c };
}
test('public entry waits until next session after a weekend filing', () => {
  const { s, c } = fixture();
  const r = simulate(s, c, 'disclosure');
  assert.equal(r.positions[0].entryDate, '2024-01-08');
  assert.equal(r.positions[0].exitDate, '2024-01-10');
  assert.ok(Math.abs(r.finalEquity - (1000 * 130) / 110) < 1e-8);
});
test('filing-day open can never be used for public copying', () => {
  const { s, c } = fixture({ filingDate: dates[1] });
  assert.equal(simulate(s, c, 'disclosure').positions[0].entryDate, dates[2]);
});
test('delay counts executable sessions and applies only to public simulation', () => {
  const { s, c } = fixture();
  c.delay = 1;
  assert.equal(simulate(s, c, 'disclosure').positions[0].entryDate, dates[2]);
  assert.equal(simulate(s, c, 'transaction').positions[0].entryDate, dates[0]);
});
test('fees obey cash conservation and charge both sides of a closed trade', () => {
  const { s, c } = fixture();
  c.costBps = 100;
  const r = simulate(s, c, 'transaction');
  const expected = (1000 / 1.01 / 100) * 120 * 0.99;
  assert.ok(Math.abs(r.finalEquity - expected) < 1e-8);
  assert.ok(r.curve.every((p) => p.cash >= -1e-8));
  assert.ok(Math.abs(r.positions[0].pnl - (expected - 1000)) < 1e-8);
});
test('cannot overdraw simultaneous orders; deterministic ordering', () => {
  const { s, c } = fixture();
  s.trades.push({ ...s.trades[0], id: 'b' });
  const r = simulate(s, c, 'transaction');
  assert.equal(r.positions.length, 1);
  assert.equal(r.skipped[0].reason, 'Insufficient cash for fixed allocation');
});
test('unknown or excluded instruments cannot enter simulation', () => {
  const { s, c } = fixture({ exclusion: 'Option exercise' });
  assert.equal(simulate(s, c, 'transaction').finalEquity, 1000);
});
test('incomplete market history is reported, never silently forward-filled', () => {
  const { s, c } = fixture();
  s.prices.ABC.bars.splice(1, 1);
  const r = simulate(s, c, 'transaction');
  assert.equal(r.positions.length, 0);
  assert.match(r.skipped[0].reason, /Incomplete/);
});
test('open positions marked at final close, with no invented exit', () => {
  const { s, c } = fixture();
  c.holding = 63;
  const r = simulate(s, c, 'transaction');
  assert.equal(r.positions[0].status, 'open');
  assert.equal(r.positions[0].exitDate, null);
  assert.equal(r.finalEquity, 1450);
  assert.equal(r.winRate, null);
});
test('benchmark receives the same capital and entry cost convention', () => {
  const { s, c } = fixture();
  c.costBps = 100;
  const r = runExperiment(s, c);
  assert.ok(Math.abs(r.curve[0].benchmark - 1000 / 1.01) < 1e-8);
});
test('invalid and nonfinite configuration rejected', () => {
  for (const invalid of [
    { capital: NaN },
    { allocation: 101 },
    { from: '2024-02-30' },
    { holding: 1.2 },
    { costBps: -1 },
  ])
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...invalid }));
});
test('changing prices after a closed position does not alter that trade', () => {
  const { s, c } = fixture();
  const before = simulate(s, c, 'transaction').positions[0].pnl;
  s.prices.ABC.bars[4][1] = 9999;
  s.prices.ABC.bars[4][2] = 9999;
  assert.equal(simulate(s, c, 'transaction').positions[0].pnl, before);
});
