'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Clock3,
  FileCheck2,
  FlaskConical,
  Code2,
  Info,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import PoliticianDirectory, {
  FrameworkGuide,
  Portrait,
  memberForExperiment,
} from '@/components/politician-directory';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  DEFAULT_CONFIG,
  runExperiment,
  daysBetween,
  type Config,
  type Snapshot,
  type Trade,
} from '@/lib/backtest';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
const pct = (n: number | null) =>
  n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const date = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const chartConfig = {
  transaction: { label: 'Trade-date estimate', color: '#9565b3' },
  disclosure: { label: 'After disclosure', color: '#388b59' },
  benchmark: { label: 'Benchmark', color: '#599ce4' },
};
const repo = 'https://github.com/talal-nabulsi/disclosure-lab';
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: [string | number, string][];
}) {
  return (
    <label className="control">
      <span>{label}</span>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
function Numeric({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="control">
      <span>{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function download(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'disclosure-experiment.json';
  a.click();
  URL.revokeObjectURL(url);
}

export default function DisclosureLab() {
  const [view, setView] = useState('backtest');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Config>(DEFAULT_CONFIG),
    [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [error, setError] = useState(''),
    [inspected, setInspected] = useState<Trade | null>(null),
    [copied, setCopied] = useState(false),
    [visible, setVisible] = useState(25);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/data/snapshot.json', { signal: abort.signal })
      .then((r) => {
        if (!r.ok)
          throw Error(
            'Research snapshot unavailable. Run the data refresh described in the README.',
          );
        return r.json();
      })
      .then((value) => {
        const s = value as Snapshot;
        if (s.manifest?.schemaVersion !== 1 || !s.prices?.SPY?.bars?.length)
          throw Error('Incomplete research snapshot.');
        setSnapshot(s);
        const c = { ...DEFAULT_CONFIG, to: s.manifest.asOf };
        try {
          const raw = new URLSearchParams(location.search).get('experiment');
          if (raw) {
            const p = JSON.parse(raw);
            for (const k of Object.keys(c) as (keyof Config)[])
              if (typeof p[k] === typeof c[k])
                (c as unknown as Record<string, unknown>)[k] = p[k];
          }
        } catch {
          setError('Shared settings could not be read. Defaults restored.');
        }
        setDraft(c);
        setConfig(c);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setLoadError(e.message);
      });
    return () => abort.abort();
  }, []);
  const result = useMemo(() => {
    if (!snapshot) return null;
    try {
      return { data: runExperiment(snapshot, config), error: '' };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [snapshot, config]);
  const r = result?.data,
    dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const patch = (key: keyof Config, value: string | number) =>
    setDraft((c) => ({ ...c, [key]: value }));
  const name =
    snapshot?.members.find((m) => m.id === config.member)?.name ||
    'All three filers';
  const selectedPerson = memberForExperiment(config.member);
  const merged = r
    ? Array.from(
        new Set(
          [...r.transaction.positions, ...r.disclosure.positions].map(
            (p) => p.trade.id,
          ),
        ),
      )
        .map((id) => ({
          id,
          a: r.transaction.positions.find((p) => p.trade.id === id),
          d: r.disclosure.positions.find((p) => p.trade.id === id),
        }))
        .sort((a, b) =>
          (b.d || b.a)!.trade.filingDate.localeCompare(
            (a.d || a.a)!.trade.filingDate,
          ),
        )
    : [];
  const selected = inspected ? merged.find((p) => p.id === inspected.id) : null;
  async function share() {
    try {
      const u = new URL(location.href);
      u.searchParams.set('experiment', JSON.stringify(config));
      await navigator.clipboard.writeText(u.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        'Clipboard unavailable. Export the experiment to save your settings.',
      );
    }
  }
  return (
    <main className="research-app">
      <header className="masthead">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <FlaskConical size={20} />
          </span>
          <span>
            THESIS LAB<span className="brand-divider">/</span>
            <b>Disclosure Lab</b>
          </span>
        </Link>
        <nav>
          <a href="#methodology">Methodology</a>
          <a href={repo} target="_blank" rel="noreferrer">
            <Code2 size={17} /> Source
          </a>
        </nav>
      </header>
      <div className="workspace">
        <div className="page-intro">
          <div>
            <h1 className="sr-only">Disclosure Lab</h1>
          </div>
          <div className="snapshot-stamp">
            <FileCheck2 size={20} />
            <div>
              <strong>
                {snapshot
                  ? `Snapshot · ${date(snapshot.manifest.asOf)}`
                  : 'Loading research snapshot'}
              </strong>
              <span>House filings · historical daily prices</span>
            </div>
          </div>
        </div>
        <Tabs
          className="workspace-tabs"
          value={view}
          onValueChange={(v) => setView(String(v))}
        >
          <TabsList className="workspace-tab-list">
            <TabsTrigger value="backtest">Backtest</TabsTrigger>
            <TabsTrigger value="people">Politicians</TabsTrigger>
            <TabsTrigger value="frameworks">How it’s built</TabsTrigger>
          </TabsList>
          <TabsContent value="people">
            <PoliticianDirectory
              onChoose={(id) => {
                setDraft((c) => ({ ...c, member: id }));
                setConfig((c) => ({ ...c, member: id }));
                setInspected(null);
                setError('');
                setVisible(25);
                setView('backtest');
              }}
            />
          </TabsContent>
          <TabsContent value="frameworks">
            <FrameworkGuide />
          </TabsContent>
          <TabsContent value="backtest">
            <div className="lab-grid">
              <aside className="configuration panel">
                <div className="panel-heading">
                  <h2>
                    <SlidersHorizontal size={17} /> Experiment settings
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reset settings"
                    onClick={() =>
                      setDraft({
                        ...DEFAULT_CONFIG,
                        to: snapshot?.manifest.asOf || DEFAULT_CONFIG.to,
                      })
                    }
                  >
                    <RotateCcw size={16} />
                  </Button>
                </div>
                <div className="config-fields">
                  <Choice
                    label="Politician"
                    value={draft.member}
                    onChange={(v) => patch('member', v)}
                    options={[
                      ['house_nancy_pelosi', 'Nancy Pelosi'],
                      ['house_marjorietaylor_greene', 'Marjorie Taylor Greene'],
                      ['house_daniel_crenshaw', 'Dan Crenshaw'],
                      ['all', 'All three · shared portfolio'],
                    ]}
                  />
                  <div className="paired-controls">
                    {(['from', 'to'] as const).map((k) => (
                      <label className="control" key={k}>
                        <span>{k === 'from' ? 'From' : 'Through'}</span>
                        <Input
                          type="date"
                          value={draft[k]}
                          min="2020-01-01"
                          max={snapshot?.manifest.asOf}
                          onChange={(e) => patch(k, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <Choice
                    label="Hold each purchase"
                    value={draft.holding}
                    onChange={(v) => patch('holding', Number(v))}
                    options={[5, 21, 63, 126, 252].map((n) => [
                      n,
                      `${n} trading sessions`,
                    ])}
                  />
                  <Choice
                    label="Benchmark"
                    value={draft.benchmark}
                    onChange={(v) => patch('benchmark', v)}
                    options={[
                      ['SPY', 'SPY · S&P 500 ETF'],
                      ['QQQ', 'QQQ · Nasdaq-100 ETF'],
                    ]}
                  />
                  <div className="paired-controls">
                    <Numeric
                      label="Starting cash ($)"
                      value={draft.capital}
                      min={100}
                      max={100000000}
                      onChange={(v) => patch('capital', v)}
                    />
                    <Numeric
                      label="Per trade (%)"
                      value={draft.allocation}
                      min={1}
                      max={100}
                      onChange={(v) => patch('allocation', v)}
                    />
                  </div>
                  <p className="control-note">
                    Fixed share of starting cash per purchase. Fractional
                    shares. Cash earns 0%.
                  </p>
                  <details className="advanced" open>
                    <summary>Execution & filters</summary>
                    <div className="advanced-fields">
                      <Numeric
                        label="Extra delay (sessions)"
                        value={draft.delay}
                        min={0}
                        max={63}
                        onChange={(v) => patch('delay', v)}
                      />
                      <Numeric
                        label="Cost per side (bps)"
                        value={draft.costBps}
                        min={0}
                        max={500}
                        onChange={(v) => patch('costBps', v)}
                      />
                      <p className="control-note">
                        10 basis points = 0.10%. Combined fee and slippage
                        assumption.
                      </p>
                      <Choice
                        label="Maximum filing delay"
                        value={draft.maxLag}
                        onChange={(v) => patch('maxLag', Number(v))}
                        options={[7, 15, 30, 45, 90, 3650].map((n) => [
                          n,
                          n === 3650
                            ? 'No practical cap'
                            : `${n} calendar days`,
                        ])}
                      />
                      <Choice
                        label="Reported purchase floor"
                        value={draft.minAmount}
                        onChange={(v) => patch('minAmount', Number(v))}
                        options={[
                          [0, 'All amounts'],
                          [15001, 'At least $15,001'],
                          [100001, 'At least $100,001'],
                          [1000001, 'At least $1,000,001'],
                        ]}
                      />
                      <Choice
                        label="Account owner"
                        value={draft.owner}
                        onChange={(v) => patch('owner', v)}
                        options={[
                          ['all', 'All reported owners'],
                          ['SP', 'Spouse'],
                          ['JT', 'Joint'],
                          ['self', 'Self / unspecified'],
                        ]}
                      />
                      <label className="control" htmlFor="ticker-filter">
                        <span>Ticker (optional)</span>
                        <Input
                          id="ticker-filter"
                          value={draft.ticker}
                          placeholder="e.g. NVDA"
                          maxLength={10}
                          onChange={(e) =>
                            patch('ticker', e.target.value.toUpperCase().trim())
                          }
                        />
                      </label>
                    </div>
                  </details>
                  <Button
                    className="run-button"
                    disabled={!snapshot}
                    onClick={() => {
                      setError('');
                      setConfig({ ...draft });
                      setInspected(null);
                      setVisible(25);
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                    {dirty ? 'Run updated experiment' : 'Run experiment'}
                  </Button>
                  <span className="config-status">
                    {dirty
                      ? 'Settings changed · results show previous run'
                      : 'Both timelines use the same strategy rules'}
                  </span>
                </div>
              </aside>
              <section className="results">
                {(loadError || error || result?.error) && (
                  <div className="error-box" role="alert">
                    {loadError || error || result?.error}
                  </div>
                )}
                {!r && !loadError && !result?.error && (
                  <output className="panel loading-result">
                    <Clock3 size={24} />
                    <h2>Loading filings and historical prices</h2>
                    <p>
                      Calculating both portfolios from the research snapshot.
                    </p>
                  </output>
                )}
                {r && snapshot && (
                  <>
                    <div className="result-top">
                      <div>
                        <p className="eyebrow">
                          EXPERIMENT / {config.benchmark}
                        </p>
                        <div className="selected-person">
                          {selectedPerson && (
                            <Portrait member={selectedPerson} />
                          )}
                          <h2>{name}</h2>
                        </div>
                        <p>
                          {date(r.curve[0].date)} – {date(r.curve.at(-1)!.date)}{' '}
                          · {config.holding}-session holds
                        </p>
                      </div>
                      <div className="result-actions">
                        <Button variant="outline" onClick={share}>
                          {copied ? (
                            <Check size={15} />
                          ) : (
                            <ArrowUpRight size={15} />
                          )}{' '}
                          {copied ? 'Copied' : 'Copy link'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            download({
                              config,
                              manifest: snapshot.manifest,
                              engineVersion: '1.0.0',
                              results: r,
                            })
                          }
                        >
                          <ArrowDownToLine size={15} /> Export
                        </Button>
                      </div>
                    </div>
                    <div className="metrics">
                      <article className="metric-card purple">
                        <div className="metric-label">
                          <i />
                          Trade-date estimate
                        </div>
                        <strong>{pct(r.transaction.totalReturn)}</strong>
                        <span>
                          {money(r.transaction.finalEquity)} ending value
                        </span>
                        <p>
                          Buy at that day’s market open.
                          <br />
                          Hypothetical hindsight comparison.
                        </p>
                      </article>
                      <article className="metric-card green">
                        <div className="metric-label">
                          <i />
                          After disclosure
                        </div>
                        <strong>{pct(r.disclosure.totalReturn)}</strong>
                        <span>
                          {money(r.disclosure.finalEquity)} ending value
                        </span>
                        <p>
                          First open after filing
                          {config.delay ? ` + ${config.delay} sessions` : ''}.
                          <br />
                          Public-copy timing model.
                        </p>
                      </article>
                      <article className="metric-card benchmark">
                        <div className="metric-label">
                          <i />
                          {config.benchmark} buy & hold
                        </div>
                        <strong>{pct(r.benchmarkReturn)}</strong>
                        <span>
                          {money(r.curve.at(-1)!.benchmark)} ending value
                        </span>
                        <p>
                          Fully invested from test start.
                          <br />
                          Same starting cash and entry cost.
                        </p>
                      </article>
                    </div>
                    <div className="panel chart-panel">
                      <div className="chart-header">
                        <div>
                          <h3>Portfolio value</h3>
                          <p>
                            Portfolio value · adjusted-price total-return
                            estimate
                          </p>
                        </div>
                        <div className="excess">
                          Follower vs. {config.benchmark}
                          <strong>
                            {r.disclosure.totalReturn - r.benchmarkReturn >= 0
                              ? '+'
                              : ''}
                            {(
                              r.disclosure.totalReturn - r.benchmarkReturn
                            ).toFixed(2)}{' '}
                            <small>pp</small>
                          </strong>
                        </div>
                      </div>
                      <div className="chart-legend">
                        {Object.entries(chartConfig).map(([key, v]) => (
                          <span key={key}>
                            <i style={{ background: v.color }} />
                            {key === 'benchmark' ? config.benchmark : v.label}
                          </span>
                        ))}
                      </div>
                      <ChartContainer
                        config={chartConfig}
                        className="equity-chart"
                      >
                        <LineChart
                          data={r.curve}
                          margin={{ top: 15, right: 8, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="#e8dcb9"
                            strokeDasharray="3 5"
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={60}
                            tickFormatter={(d) => d.slice(0, 7)}
                            tickMargin={14}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={65}
                            domain={['auto', 'auto']}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                labelFormatter={(v) => date(String(v))}
                                formatter={(value, name) => (
                                  <span className="tooltip-value">
                                    {
                                      chartConfig[
                                        name as keyof typeof chartConfig
                                      ]?.label
                                    }
                                    <b>{money(Number(value))}</b>
                                  </span>
                                )}
                              />
                            }
                          />
                          {Object.entries(chartConfig).map(([key, v]) => (
                            <Line
                              key={key}
                              dataKey={key}
                              type="linear"
                              stroke={v.color}
                              strokeWidth={key === 'disclosure' ? 2.5 : 1.7}
                              strokeDasharray={
                                key === 'benchmark' ? '5 5' : undefined
                              }
                              dot={false}
                              isAnimationActive={false}
                            />
                          ))}
                        </LineChart>
                      </ChartContainer>
                      <div className="chart-stats">
                        <div>
                          <span>Public-copy drawdown</span>
                          <strong>{pct(r.disclosure.maxDrawdown)}</strong>
                        </div>
                        <div>
                          <span>Executed purchases</span>
                          <strong>
                            {r.disclosure.positions.length}
                            <small>
                              {' '}
                              public / {r.transaction.positions.length}{' '}
                              trade-date
                            </small>
                          </strong>
                        </div>
                        <div>
                          <span>Median filing delay</span>
                          <strong>
                            {r.medianLag ?? '—'}
                            <small> days</small>
                          </strong>
                        </div>
                        <div>
                          <span>Public-copy costs</span>
                          <strong>{money(r.disclosure.costs)}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="interpretation">
                      <Info size={19} />
                      <div>
                        <strong>
                          {r.disclosure.positions.length === 0
                            ? 'No eligible purchases executed under these settings.'
                            : `Following these disclosures ${r.disclosure.totalReturn >= r.benchmarkReturn ? 'outperformed' : 'underperformed'} ${config.benchmark} in this simulation.`}
                        </strong>
                        <p>
                          {r.eligibleCount} eligible purchase rows from{' '}
                          {r.selectedCount} selected disclosures.{' '}
                          {
                            r.disclosure.positions.filter(
                              (p) => p.status === 'open',
                            ).length
                          }{' '}
                          positions remain open, marked at the final close.{' '}
                          {r.disclosure.positions.length < 30
                            ? 'Small sample: treat this as exploratory. '
                            : ''}
                          The difference includes selection, time in cash, costs
                          and timing; it does not establish investment skill.
                        </p>
                      </div>
                    </div>
                    <div className="panel evidence-panel">
                      <Tabs
                        defaultValue="trades"
                        onValueChange={() => setVisible(25)}
                      >
                        <TabsList variant="line">
                          <TabsTrigger value="trades">
                            Executed trades ({merged.length})
                          </TabsTrigger>
                          <TabsTrigger value="excluded">
                            Exclusions ({r.disclosure.skipped.length})
                          </TabsTrigger>
                          <TabsTrigger value="timing">The timing</TabsTrigger>
                        </TabsList>
                        <TabsContent value="trades">
                          <p className="table-hint">
                            Inspect any trade to see its source and calculation.
                            Returns below are per position.
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {[
                                  'Stock / owner',
                                  'Traded',
                                  'Filed',
                                  'Lag',
                                  'Trade-date return',
                                  'Public-copy return',
                                  '',
                                ].map((x) => (
                                  <TableHead key={x}>{x}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {merged.slice(0, visible).map((row) => {
                                const t = (row.d || row.a)!.trade;
                                return (
                                  <TableRow key={row.id}>
                                    <TableCell>
                                      <strong>{t.ticker}</strong>
                                      <span className="cell-sub">
                                        {t.owner === 'SP'
                                          ? 'Spouse'
                                          : t.owner || 'Unspecified'}
                                      </span>
                                    </TableCell>
                                    <TableCell>{t.transactionDate}</TableCell>
                                    <TableCell className="public-date">
                                      {t.filingDate}
                                    </TableCell>
                                    <TableCell>
                                      {daysBetween(
                                        t.transactionDate,
                                        t.filingDate,
                                      )}
                                      d
                                    </TableCell>
                                    <TableCell className="purple-text">
                                      {pct(row.a?.returnPct ?? null)}
                                      {row.a?.status === 'open' && (
                                        <span className="cell-sub">
                                          Open · marked
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="green-text">
                                      {pct(row.d?.returnPct ?? null)}
                                      {row.d?.status === 'open' && (
                                        <span className="cell-sub">
                                          Open · marked
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setInspected(t)}
                                        aria-label={`Inspect ${t.ticker} ${t.transactionDate}`}
                                      >
                                        Inspect ↗
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          {!merged.length && (
                            <p className="empty-note">
                              No executed trades. Broaden the filters or inspect
                              exclusions.
                            </p>
                          )}
                          {merged.length > visible && (
                            <Button
                              className="more-button"
                              variant="outline"
                              onClick={() => setVisible((n) => n + 50)}
                            >
                              Show 50 more
                            </Button>
                          )}
                        </TabsContent>
                        <TabsContent value="excluded">
                          <p className="table-hint">
                            Public-copy omissions, including source uncertainty,
                            unsupported assets and cash constraints.
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Asset</TableHead>
                                <TableHead>Filed</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Source</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.disclosure.skipped
                                .slice(0, visible)
                                .map(({ trade: t, reason }, i) => (
                                  <TableRow key={t.id + i}>
                                    <TableCell>
                                      {t.ticker || 'Unresolved'}
                                      <span className="cell-sub">
                                        {t.assetType || 'Unknown'} · {t.type}
                                      </span>
                                    </TableCell>
                                    <TableCell>{t.filingDate}</TableCell>
                                    <TableCell className="wrap-cell">
                                      {reason}
                                    </TableCell>
                                    <TableCell>
                                      <a
                                        className="filing-link"
                                        href={t.source}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Filing ↗
                                      </a>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                          {r.disclosure.skipped.length > visible && (
                            <Button
                              className="more-button"
                              variant="outline"
                              onClick={() => setVisible((n) => n + 50)}
                            >
                              Show 50 more
                            </Button>
                          )}
                        </TabsContent>
                        <TabsContent value="timing">
                          <div className="timing-grid">
                            <article>
                              <span className="timeline-number purple-text">
                                01
                              </span>
                              <h3>Transaction date</h3>
                              <p>
                                The reported day a transaction happened. We
                                estimate buying at that day’s open. The
                                execution time and actual price are generally
                                undisclosed.
                              </p>
                            </article>
                            <article>
                              <span className="timeline-number">02</span>
                              <h3>Filing date</h3>
                              <p>
                                The date in the House’s official index. A
                                public-availability proxy: historical timestamps
                                proving when documents appeared online are
                                unavailable.
                              </p>
                            </article>
                            <article>
                              <span className="timeline-number green-text">
                                03
                              </span>
                              <h3>Follower entry</h3>
                              <p>
                                The first market open strictly after filing,
                                plus your extra delay. Weekends and market
                                holidays move the entry to the next available
                                session.
                              </p>
                            </article>
                          </div>
                          <p className="timing-footnote">
                            Both portfolios hold for the same number of sessions
                            from their own entries, so exit dates differ. The
                            performance gap also reflects different holding
                            windows and available cash; it is not a pure
                            measurement of disclosure delay.
                          </p>
                        </TabsContent>
                      </Tabs>
                    </div>
                    {inspected && selected && (
                      <section className="panel inspection">
                        <div className="panel-heading">
                          <h3>
                            {inspected.ticker} ·{' '}
                            {date(inspected.transactionDate)}
                          </h3>
                          <Button
                            variant="ghost"
                            onClick={() => setInspected(null)}
                          >
                            Close
                          </Button>
                        </div>
                        <p>{inspected.description || inspected.asset}</p>
                        <div className="inspection-grid">
                          {[
                            {
                              p: selected.a,
                              label: 'Trade-date estimate',
                              cls: 'purple-text',
                            },
                            {
                              p: selected.d,
                              label: 'Public-copy simulation',
                              cls: 'green-text',
                            },
                          ].map(({ p, label, cls }) => (
                            <article key={label}>
                              <h4 className={cls}>{label}</h4>
                              {p ? (
                                <dl>
                                  <dt>Entry session</dt>
                                  <dd>{p.entryDate}</dd>
                                  <dt>Adjusted entry</dt>
                                  <dd>${p.entryPrice.toFixed(4)}</dd>
                                  <dt>Exit / mark date</dt>
                                  <dd>
                                    {p.exitDate || r.curve.at(-1)!.date}{' '}
                                    {p.status === 'open' ? '(open)' : ''}
                                  </dd>
                                  <dt>Adjusted exit / mark</dt>
                                  <dd>${p.exitPrice.toFixed(4)}</dd>
                                  <dt>Allocated cash</dt>
                                  <dd>{money(p.invested)}</dd>
                                  <dt>Net gain / loss</dt>
                                  <dd>
                                    {money(p.pnl)} / {pct(p.returnPct)}
                                  </dd>
                                  <dt>{config.benchmark}, same window</dt>
                                  <dd>{pct(p.benchmarkPct)} before costs</dd>
                                </dl>
                              ) : (
                                <p>
                                  Skipped in this scenario; see experiment
                                  export for the reason.
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                        <p className="control-note">
                          Adjusted prices are research units, not actual quoted
                          historical prices. {inspected.verification}. Reported
                          amount: {inspected.amountLabel}.
                        </p>
                        <a
                          className="filing-link"
                          href={inspected.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Read original House filing ↗
                        </a>
                      </section>
                    )}
                  </>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
        <section id="methodology" className="methodology">
          <div>
            <h2>Methodology</h2>
          </div>
          <div className="methodology-body">
            <details open>
              <summary>Sources, coverage & accuracy</summary>
              <p>
                Disclosures come from Kadoa’s Congress Trading Monitor at a
                pinned commit. Eligible purchases are checked against the House
                Clerk’s index and original PDFs for ticker, type, date,
                direction and amount range. This selected sample covers three
                House filers from 2020 onward; it is not a complete
                congressional database. Options, exercises, transfers,
                unresolved rows and possible duplicates are excluded and shown.
              </p>
              <p>
                Yahoo Finance supplies daily prices. Opens and closes use
                dividend- and split-adjusted research units, estimating total
                return without reconstructing exact dividend cash flows or
                brokerage fills. A missing price anywhere in the required future
                holding window excludes the entire purchase. This retrospective
                data-availability filter can introduce selection bias.
              </p>
            </details>
            <details>
              <summary>Portfolio accounting & the two clocks</summary>
              <p>
                Each purchase receives a fixed percentage of starting cash,
                including entry costs. Fractional shares are allowed, borrowing
                is not, and unused cash earns 0%. Exits occur at the open after
                the selected number of benchmark trading sessions. Scheduled
                exits precede entries; same-day entries sort by transaction
                date, then stable record ID. Orders without enough cash are
                skipped.
              </p>
              <p>
                The trade-date portfolio enters on or after the transaction
                date. The follower enters strictly after the filing date plus
                any extra session delay. Both use the same configured holding
                length. Unfinished positions stay open at the final close with
                no invented sale or exit fee.
              </p>
            </details>
            <details>
              <summary>How to interpret these results</summary>
              <p>
                The purple curve is a hypothetical portfolio using reported
                purchase dates. It is not any filer’s actual personal return.
                Execution prices, full holdings and precise transaction sizes
                are generally unavailable. Spouse and joint ownership labels are
                preserved.
              </p>
              <p>
                Both portfolios use only disclosures filed by the test end;
                changing that cutoff can change earlier simulated trades. This
                is a retrospective matched-cohort comparison, not a fully
                point-in-time trading record. The benchmark invests all starting
                cash at the first open and holds. The return difference is
                measured in percentage points; it is not risk-adjusted alpha.
                Time in cash and sector exposure matter. These exploratory
                backtests have no holdout validation or statistical-significance
                claim. Repeated tuning can overfit the sample. Returns do not
                establish illegal conduct.
              </p>
            </details>
            <details>
              <summary>Reproduce or refresh an experiment</summary>
              <p>
                The deterministic TypeScript engine runs in the browser and from
                the command line. Export includes settings, source revision,
                daily equity, trades and exclusions. The README documents
                installation, the Python snapshot pipeline, tests, limitations
                and server hosting. Refreshes are manual; the snapshot date is
                its cutoff.
              </p>
              <a
                className="filing-link"
                href={repo}
                target="_blank"
                rel="noreferrer"
              >
                Repository & README ↗
              </a>
            </details>
          </div>
        </section>
        <footer className="site-footer">
          <span>THESIS LAB / DISCLOSURE LAB</span>
          <span>Research simulation · no brokerage connection</span>
          <a
            href="https://disclosures-clerk.house.gov/FinancialDisclosure"
            target="_blank"
            rel="noreferrer"
          >
            House Clerk archive ↗
          </a>
        </footer>
      </div>
    </main>
  );
}
