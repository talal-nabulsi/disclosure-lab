export type Trade = {
  id: string;
  member: string;
  ticker: string | null;
  asset: string;
  assetType: string | null;
  type: string;
  owner: string | null;
  transactionDate: string;
  filingDate: string;
  amountLow: number | null;
  amountHigh: number | null;
  amountLabel: string;
  description: string;
  source: string;
  exclusion: string | null;
  verification: string;
  sourceHash?: string;
  evidence?: string;
};
export type Bar = [string, number, number]; // date, adjusted open, adjusted close
export type Snapshot = {
  manifest: {
    asOf: string;
    builtAt: string;
    upstreamRevision: string;
    upstream: string;
    priceConvention: string;
    disclosureConvention: string;
    coverage: string;
    officialDocumentsChecked: number;
    priceIssues: { ticker: string; reason: string }[];
    schemaVersion: number;
  };
  members: { id: string; name: string; party: string | null; state: string }[];
  trades: Trade[];
  prices: Record<
    string,
    {
      bars: Bar[];
      source: string;
      sha256: string;
      currency: string;
      instrument: string;
    }
  >;
};
export type Config = {
  member: string;
  from: string;
  to: string;
  benchmark: string;
  holding: number;
  delay: number;
  costBps: number;
  capital: number;
  allocation: number;
  minAmount: number;
  maxLag: number;
  owner: string;
  ticker: string;
};
export const DEFAULT_CONFIG: Config = {
  member: 'house_nancy_pelosi',
  from: '2020-01-01',
  to: '2026-09-04',
  benchmark: 'SPY',
  holding: 63,
  delay: 0,
  costBps: 10,
  capital: 10000,
  allocation: 10,
  minAmount: 0,
  maxLag: 3650,
  owner: 'all',
  ticker: '',
};
export type Position = {
  trade: Trade;
  entryDate: string;
  exitDate: string | null;
  plannedExitDate: string | null;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  invested: number;
  proceeds: number;
  pnl: number;
  returnPct: number;
  benchmarkPct: number;
  status: 'closed' | 'open';
  lagDays: number;
};
export type CurvePoint = { date: string; equity: number; cash: number };
export type Scenario = {
  curve: CurvePoint[];
  positions: Position[];
  skipped: { trade: Trade; reason: string }[];
  totalReturn: number;
  maxDrawdown: number;
  finalEquity: number;
  costs: number;
  winRate: number | null;
};
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000,
  );

export function validateConfig(c: Config) {
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!date(c.from) || !date(c.to) || c.from > c.to)
    throw new Error('Choose a valid start and end date.');
  for (const [key, min, max] of [
    ['holding', 1, 756],
    ['delay', 0, 63],
    ['costBps', 0, 500],
    ['capital', 100, 1e8],
    ['allocation', 1, 100],
    ['minAmount', 0, 1e9],
    ['maxLag', 0, 3650],
  ] as const) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`Invalid ${key}: allowed range ${min}–${max}.`);
  }
  if (!Number.isInteger(c.holding) || !Number.isInteger(c.delay))
    throw new Error(
      'Holding period and execution delay must be whole sessions.',
    );
  if (!['SPY', 'QQQ'].includes(c.benchmark))
    throw new Error('Select SPY or QQQ.');
}

export function selectedTrades(s: Snapshot, c: Config) {
  return s.trades.filter(
    (t) =>
      (c.member === 'all' || t.member === c.member) &&
      t.transactionDate >= c.from &&
      t.filingDate <= c.to &&
      t.transactionDate <= t.filingDate &&
      (c.owner === 'all' || (t.owner || 'self') === c.owner) &&
      (!c.ticker || t.ticker === c.ticker.toUpperCase()) &&
      (t.amountLow || 0) >= c.minAmount &&
      daysBetween(t.transactionDate, t.filingDate) <= c.maxLag,
  );
}

export function simulate(
  s: Snapshot,
  c: Config,
  basis: 'transaction' | 'disclosure',
): Scenario {
  validateConfig(c);
  const benchmark = s.prices[c.benchmark];
  if (!benchmark) throw new Error('Benchmark history is missing.');
  const calendar = benchmark.bars
    .filter((b) => b[0] >= c.from && b[0] <= c.to)
    .map((b) => b[0]);
  if (!calendar.length) throw new Error('No market data in that date range.');
  const maps = Object.fromEntries(
    Object.entries(s.prices).map(([ticker, p]) => [
      ticker,
      new Map(p.bars.map((b) => [b[0], b])),
    ]),
  );
  const candidates = selectedTrades(s, c);
  const skipped: Scenario['skipped'] = [];
  const events = new Map<string, { trade: Trade; exit: string | null }[]>();
  for (const trade of candidates) {
    if (trade.exclusion) {
      skipped.push({ trade, reason: trade.exclusion });
      continue;
    }
    const index = calendar.findIndex((date) =>
      basis === 'transaction'
        ? date >= trade.transactionDate
        : date > trade.filingDate,
    );
    const entryIndex =
      index < 0 ? -1 : index + (basis === 'disclosure' ? c.delay : 0);
    if (entryIndex < 0 || entryIndex >= calendar.length) {
      skipped.push({ trade, reason: 'No executable session before test end' });
      continue;
    }
    const entry = calendar[entryIndex];
    const exit = calendar[entryIndex + c.holding] || null;
    const history = trade.ticker ? maps[trade.ticker] : undefined;
    // Never forward-fill a missing entry, exit, or mark. Missing data changes coverage, visibly.
    const needed = calendar.slice(
      entryIndex,
      Math.min(entryIndex + c.holding + 1, calendar.length),
    );
    if (!history || needed.some((date) => !history.has(date))) {
      skipped.push({
        trade,
        reason: 'Incomplete price history over required holding window',
      });
      continue;
    }
    const values = events.get(entry) || [];
    values.push({ trade, exit });
    events.set(entry, values);
  }
  let cash = c.capital,
    costs = 0;
  const positions: Position[] = [],
    active: Position[] = [],
    curve: CurvePoint[] = [];
  const cost = c.costBps / 10000;
  for (const date of calendar) {
    // All exits are scheduled before the session opens; exit cash is available for new entries.
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      if (p.plannedExitDate !== date) continue;
      const open = maps[p.trade.ticker!].get(date)![1];
      const gross = p.quantity * open;
      p.exitDate = date;
      p.exitPrice = open;
      p.proceeds = gross * (1 - cost);
      p.pnl = p.proceeds - p.invested;
      p.returnPct = (p.pnl / p.invested) * 100;
      p.status = 'closed';
      p.benchmarkPct =
        (maps[c.benchmark].get(date)![1] /
          maps[c.benchmark].get(p.entryDate)![1] -
          1) *
        100;
      costs += gross * cost;
      cash += p.proceeds;
      active.splice(i, 1);
    }
    const today = (events.get(date) || []).sort(
      (a, b) =>
        a.trade.transactionDate.localeCompare(b.trade.transactionDate) ||
        a.trade.id.localeCompare(b.trade.id),
    );
    for (const event of today) {
      const budget = (c.capital * c.allocation) / 100;
      if (cash + 1e-8 < budget) {
        skipped.push({
          trade: event.trade,
          reason: 'Insufficient cash for fixed allocation',
        });
        continue;
      }
      const open = maps[event.trade.ticker!].get(date)![1];
      const notional = budget / (1 + cost);
      const p: Position = {
        trade: event.trade,
        entryDate: date,
        exitDate: null,
        plannedExitDate: event.exit,
        entryPrice: open,
        exitPrice: open,
        quantity: notional / open,
        invested: budget,
        proceeds: notional,
        pnl: -notional * cost,
        returnPct: 0,
        benchmarkPct: 0,
        status: 'open',
        lagDays: daysBetween(
          event.trade.transactionDate,
          event.trade.filingDate,
        ),
      };
      cash -= budget;
      costs += notional * cost;
      positions.push(p);
      active.push(p);
    }
    let equity = cash;
    for (const p of active) {
      const close = maps[p.trade.ticker!].get(date)![2];
      p.exitPrice = close;
      p.proceeds = p.quantity * close;
      p.pnl = p.proceeds - p.invested;
      p.returnPct = (p.pnl / p.invested) * 100;
      p.benchmarkPct =
        (maps[c.benchmark].get(date)![2] /
          maps[c.benchmark].get(p.entryDate)![1] -
          1) *
        100;
      equity += p.proceeds;
    }
    curve.push({ date, equity, cash });
  }
  let peak = c.capital,
    maxDrawdown = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.equity);
    maxDrawdown = Math.min(maxDrawdown, (p.equity / peak - 1) * 100);
  }
  const finalEquity = curve.at(-1)!.equity;
  const closed = positions.filter((p) => p.status === 'closed');
  return {
    curve,
    positions,
    skipped,
    totalReturn: (finalEquity / c.capital - 1) * 100,
    maxDrawdown,
    finalEquity,
    costs,
    winRate: closed.length
      ? (closed.filter((p) => p.pnl > 0).length / closed.length) * 100
      : null,
  };
}

export function runExperiment(s: Snapshot, c: Config) {
  const transaction = simulate(s, c, 'transaction');
  const disclosure = simulate(s, c, 'disclosure');
  const b = s.prices[c.benchmark].bars.filter(
    (b) => b[0] >= c.from && b[0] <= c.to,
  );
  const cost = c.costBps / 10000;
  const quantity = c.capital / (1 + cost) / b[0][1];
  const benchmark = new Map(b.map((bar) => [bar[0], quantity * bar[2]]));
  const curve = transaction.curve.map((p, i) => ({
    date: p.date,
    transaction: p.equity,
    disclosure: disclosure.curve[i].equity,
    benchmark: benchmark.get(p.date)!,
  }));
  const benchmarkReturn = (curve.at(-1)!.benchmark / c.capital - 1) * 100;
  const selected = selectedTrades(s, c);
  const lags = selected
    .filter((t) => !t.exclusion)
    .map((t) => daysBetween(t.transactionDate, t.filingDate))
    .sort((a, b) => a - b);
  const medianLag = lags.length
    ? (lags[Math.floor((lags.length - 1) / 2)] +
        lags[Math.ceil((lags.length - 1) / 2)]) /
      2
    : null;
  return {
    transaction,
    disclosure,
    curve,
    benchmarkReturn,
    medianLag,
    selectedCount: selected.length,
    eligibleCount: selected.filter((t) => !t.exclusion).length,
  };
}
