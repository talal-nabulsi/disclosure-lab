'use client';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Play, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DEFAULT_CONFIG, type Config, type Snapshot } from '@/lib/backtest';
import { runComparison } from '@/lib/comparison';
import {
  memberForExperiment,
  Portrait,
} from '@/components/politician-directory';

const palette = [
  '#397ab5',
  '#28835c',
  '#a76540',
  '#8955ab',
  '#b38b21',
  '#337f89',
  '#a85279',
  '#6c7a37',
  '#725b43',
  '#6975bb',
  '#b35b4c',
  '#318b9b',
];
const percent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="control">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function PoliticianComparison({
  snapshot,
  onInspect,
}: {
  snapshot: Snapshot;
  onInspect: (config: Config) => void;
}) {
  const [draft, setDraft] = useState<Config>({
    ...DEFAULT_CONFIG,
    to: snapshot.manifest.asOf,
  });
  const [config, setConfig] = useState(draft);
  const [basis, setBasis] = useState<'disclosure' | 'transaction'>(
    'disclosure',
  );
  const [hidden, setHidden] = useState<string[]>([]);
  const [sort, setSort] = useState('return');
  const computed = useMemo(() => {
    try {
      return { data: runComparison(snapshot, config), error: '' };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [snapshot, config]);
  const r = computed.data;
  const patch = (key: keyof Config, value: string | number) =>
    setDraft((c) => ({ ...c, [key]: value }));
  const dirty = JSON.stringify(config) !== JSON.stringify(draft);
  const colors = Object.fromEntries(
    (r?.rows || []).map((row, i) => [
      row.member.id,
      palette[i % palette.length],
    ]),
  );
  const chartConfig = {
    benchmark: { label: config.benchmark, color: '#393b40' },
    ...Object.fromEntries(
      (r?.rows || []).map((row) => [
        `${row.member.id}_${basis}`,
        { label: row.member.name, color: colors[row.member.id] },
      ]),
    ),
  };
  const sorted = r
    ? [...r.rows].sort((a, b) =>
        sort === 'name'
          ? a.member.name.localeCompare(b.member.name)
          : sort === 'trades'
            ? b.result[basis].positions.length -
              a.result[basis].positions.length
            : b.result[basis].totalReturn - a.result[basis].totalReturn,
      )
    : [];
  function exportRun() {
    if (!r) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            engineVersion: '1.0.0',
            manifest: snapshot.manifest,
            config,
            basis,
            comparison: r,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'politician-comparison.json';
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <div>
          <h2 id="comparison-title">Compare politicians</h2>
          <p>
            {r?.rows.length || 'Available'} separate simulated portfolios · same
            strategy settings
          </p>
        </div>
        <Button variant="outline" onClick={exportRun} disabled={!r}>
          <Download size={15} /> Export results
        </Button>
      </div>
      <div className="panel comparison-controls">
        <div className="comparison-control-grid">
          <Field label="From">
            <Input
              aria-label="Comparison start date"
              type="date"
              value={draft.from}
              min="2020-01-01"
              max={snapshot.manifest.asOf}
              onChange={(e) => patch('from', e.target.value)}
            />
          </Field>
          <Field label="Through">
            <Input
              aria-label="Comparison end date"
              type="date"
              value={draft.to}
              min="2020-01-01"
              max={snapshot.manifest.asOf}
              onChange={(e) => patch('to', e.target.value)}
            />
          </Field>
          <Field label="Holding period">
            <NativeSelect
              aria-label="Comparison holding period"
              value={draft.holding}
              onChange={(e) => patch('holding', Number(e.target.value))}
            >
              {[5, 21, 63, 126, 252].map((n) => (
                <option key={n} value={n}>
                  {n} trading sessions
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Benchmark">
            <NativeSelect
              aria-label="Comparison benchmark"
              value={draft.benchmark}
              onChange={(e) => patch('benchmark', e.target.value)}
            >
              <option>SPY</option>
              <option>QQQ</option>
            </NativeSelect>
          </Field>
          <Field label="Per purchase (%)">
            <Input
              aria-label="Comparison allocation"
              type="number"
              min={1}
              max={100}
              value={draft.allocation}
              onChange={(e) => patch('allocation', Number(e.target.value))}
            />
          </Field>
          <Field label="Cost per side (bps)">
            <Input
              aria-label="Comparison costs"
              type="number"
              min={0}
              max={500}
              value={draft.costBps}
              onChange={(e) => patch('costBps', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="comparison-run-row">
          <details className="comparison-advanced">
            <summary>
              <Settings2 size={15} /> More settings
            </summary>
            <div className="comparison-extra-grid">
              <Field label="Starting cash ($)">
                <Input
                  aria-label="Comparison capital"
                  type="number"
                  min={100}
                  max={100000000}
                  value={draft.capital}
                  onChange={(e) => patch('capital', Number(e.target.value))}
                />
              </Field>
              <Field label="Extra delay (sessions)">
                <Input
                  aria-label="Comparison execution delay"
                  type="number"
                  min={0}
                  max={63}
                  value={draft.delay}
                  onChange={(e) => patch('delay', Number(e.target.value))}
                />
              </Field>
              <Field label="Maximum filing lag (days)">
                <Input
                  aria-label="Comparison maximum filing lag"
                  type="number"
                  min={0}
                  max={3650}
                  value={draft.maxLag}
                  onChange={(e) => patch('maxLag', Number(e.target.value))}
                />
              </Field>
              <Field label="Reported purchase floor ($)">
                <Input
                  aria-label="Comparison amount floor"
                  type="number"
                  min={0}
                  max={1000000000}
                  value={draft.minAmount}
                  onChange={(e) => patch('minAmount', Number(e.target.value))}
                />
              </Field>
              <Field label="Account owner">
                <NativeSelect
                  aria-label="Comparison account owner"
                  value={draft.owner}
                  onChange={(e) => patch('owner', e.target.value)}
                >
                  <option value="all">All owners</option>
                  <option value="SP">Spouse</option>
                  <option value="JT">Joint</option>
                  <option value="self">Self / unspecified</option>
                </NativeSelect>
              </Field>
              <Field label="Ticker (optional)">
                <Input
                  aria-label="Comparison ticker"
                  value={draft.ticker}
                  placeholder="All stocks"
                  maxLength={10}
                  onChange={(e) =>
                    patch('ticker', e.target.value.trim().toUpperCase())
                  }
                />
              </Field>
            </div>
          </details>
          <div className="comparison-run-actions">
            <span>
              {dirty ? 'Unapplied settings' : '10 bps = 0.10% per side'}
            </span>
            <Button onClick={() => setConfig({ ...draft })}>
              <Play size={14} /> Run comparison
            </Button>
          </div>
        </div>
      </div>
      {computed.error && (
        <div className="error-box" role="alert">
          {computed.error}
        </div>
      )}
      {r && (
        <>
          <div className="comparison-summary">
            <div>
              <span>Backtested politicians</span>
              <strong>{r.rows.length}</strong>
            </div>
            <div>
              <span>
                Executed purchases ·{' '}
                {basis === 'disclosure' ? 'public-copy' : 'trade-date'}
              </span>
              <strong>
                {r.rows.reduce(
                  (n, row) => n + row.result[basis].positions.length,
                  0,
                )}
              </strong>
            </div>
            <div>
              <span>{config.benchmark} return</span>
              <strong>{percent(r.benchmarkReturn)}</strong>
            </div>
            <div>
              <span>Starting cash · each portfolio</span>
              <strong>${config.capital.toLocaleString('en-US')}</strong>
            </div>
          </div>
          <div className="panel comparison-chart-panel">
            <div className="comparison-chart-heading">
              <div>
                <h3>Portfolio returns</h3>
                <p>
                  {r.from} – {r.to} · {config.holding}-session holds ·{' '}
                  {config.allocation}% of initial cash per purchase
                </p>
              </div>
              <Field label="Entry timing">
                <NativeSelect
                  aria-label="Comparison entry timing"
                  value={basis}
                  onChange={(e) => setBasis(e.target.value as typeof basis)}
                >
                  <option value="disclosure">After disclosure</option>
                  <option value="transaction">Trade-date estimate</option>
                </NativeSelect>
              </Field>
            </div>
            <p className="comparison-timing-note">
              {basis === 'disclosure'
                ? `Entry: first market open strictly after the filing date${config.delay ? `, plus ${config.delay} trading sessions` : ''}. Filing date is a public-availability proxy.`
                : 'Hypothetical purchase at the reported transaction-date open. Not the politician’s actual execution price or portfolio return.'}
            </p>
            <ChartContainer
              className="comparison-equity-chart"
              config={chartConfig}
            >
              <LineChart
                data={r.curve}
                margin={{ top: 16, right: 18, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e8dcb9"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={70}
                  tickFormatter={(v) => String(v).slice(0, 7)}
                  tickMargin={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={66}
                  tickFormatter={(v) => `${Math.round(Number(v))}%`}
                />
                <ReferenceLine y={0} stroke="#bcae8b" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => String(v)}
                      formatter={(value, name) => (
                        <span className="tooltip-value">
                          {chartConfig[name as keyof typeof chartConfig]?.label}
                          <b>{percent(Number(value))}</b>
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  type="linear"
                  dataKey="benchmark"
                  stroke="#393b40"
                  strokeDasharray="6 5"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {r.rows
                  .filter((row) => !hidden.includes(row.member.id))
                  .map((row) => (
                    <Line
                      key={row.member.id}
                      type="linear"
                      dataKey={`${row.member.id}_${basis}`}
                      stroke={colors[row.member.id]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ChartContainer>
            <div className="comparison-legend-heading">
              <span>
                <i className="benchmark-dash" />
                {config.benchmark} buy & hold
              </span>
              <Button variant="ghost" size="sm" onClick={() => setHidden([])}>
                Show all lines
              </Button>
            </div>
            <div className="comparison-legend">
              {r.rows.map((row) => {
                const person = memberForExperiment(row.member.id);
                return (
                  <label
                    key={row.member.id}
                    className={`comparison-member-chip ${hidden.includes(row.member.id) ? 'line-hidden' : ''}`}
                  >
                    <Checkbox
                      checked={!hidden.includes(row.member.id)}
                      onCheckedChange={(checked) =>
                        setHidden((ids) =>
                          checked
                            ? ids.filter((id) => id !== row.member.id)
                            : [...ids, row.member.id],
                        )
                      }
                      aria-label={`Show ${row.member.name} line`}
                    />
                    {person && <Portrait member={person} />}
                    <span>
                      <b>{row.member.name}</b>
                      <small style={{ color: colors[row.member.id] }}>
                        {percent(row.result[basis].totalReturn)}
                      </small>
                    </span>
                    <i style={{ background: colors[row.member.id] }} />
                  </label>
                );
              })}
            </div>
          </div>
          <div className="panel comparison-table">
            <div className="comparison-table-heading">
              <div>
                <h3>Results by politician</h3>
                <p>
                  Independent cash accounts. No combined portfolio or averaged
                  return.
                </p>
              </div>
              <Field label="Sort by">
                <NativeSelect
                  aria-label="Sort comparison results"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="return">Selected-timing return</option>
                  <option value="name">Name</option>
                  <option value="trades">Executed purchases</option>
                </NativeSelect>
              </Field>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'Politician',
                    'After disclosure',
                    'Trade-date estimate',
                    `Vs ${config.benchmark} (pp)`,
                    'Executed / eligible',
                    'Max drawdown',
                    '',
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const p = memberForExperiment(row.member.id),
                    scenario = row.result[basis];
                  return (
                    <TableRow key={row.member.id}>
                      <TableCell>
                        <div className="comparison-table-person">
                          {p && <Portrait member={p} />}
                          <span>
                            <strong>{row.member.name}</strong>
                            <small>
                              {row.member.state} ·{' '}
                              {row.member.party || 'Unspecified'}
                              {scenario.positions.length < 30
                                ? ' · Small sample'
                                : ''}
                            </small>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {percent(row.result.disclosure.totalReturn)}
                      </TableCell>
                      <TableCell>
                        {percent(row.result.transaction.totalReturn)}
                      </TableCell>
                      <TableCell>
                        {(scenario.totalReturn - r.benchmarkReturn).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {scenario.positions.length} / {row.result.eligibleCount}
                        <small className="cell-sub">
                          {
                            scenario.positions.filter(
                              (p) => p.status === 'open',
                            ).length
                          }{' '}
                          open · {scenario.skipped.length} excluded/skipped
                        </small>
                      </TableCell>
                      <TableCell>{percent(scenario.maxDrawdown)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onInspect({ ...config, member: row.member.id })
                          }
                        >
                          Inspect trades
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="comparison-caveats">
            <p>
              <strong>Coverage:</strong> {snapshot.members.length} selected
              House filers screened; {r.rows.length} have eligible stock
              purchases. Options and unsupported records are excluded.
              Availability-based selection is not representative of Congress.
            </p>
            <p>
              Returns include different cash exposure and holding windows. The
              benchmark is fully invested, not exposure-matched. Missing future
              prices can exclude entire trades, creating selection bias. This is
              an exploratory simulation—not actual politician returns,
              risk-adjusted alpha or an investment recommendation.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
