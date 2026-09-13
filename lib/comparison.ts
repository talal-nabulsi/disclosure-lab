import {
  runExperiment,
  validateConfig,
  type Config,
  type Snapshot,
} from './backtest.ts';

export function availableMembers(s: Snapshot) {
  const ids = new Set(
    s.trades.filter((t) => !t.exclusion).map((t) => t.member),
  );
  return s.members.filter((m) => ids.has(m.id));
}

/** Each member has a separate cash account, with identical rules and date bounds. */
export function runComparison(s: Snapshot, c: Config) {
  validateConfig(c);
  const members = availableMembers(s);
  if (!members.length)
    throw Error('No politicians have eligible purchase data.');
  const rows = members.map((member) => ({
    member,
    result: runExperiment(s, { ...c, member: member.id }),
  }));
  const curve = rows[0].result.curve.map((point, index) => {
    const result: Record<string, string | number> = {
      date: point.date,
      benchmark: (point.benchmark / c.capital - 1) * 100,
    };
    for (const row of rows) {
      const p = row.result.curve[index];
      if (p.date !== point.date)
        throw Error('Comparison calendars are not aligned.');
      result[`${row.member.id}_disclosure`] =
        (p.disclosure / c.capital - 1) * 100;
      result[`${row.member.id}_transaction`] =
        (p.transaction / c.capital - 1) * 100;
    }
    return result;
  });
  return {
    rows,
    curve,
    benchmarkReturn: rows[0].result.benchmarkReturn,
    from: rows[0].result.curve[0].date,
    to: rows[0].result.curve.at(-1)!.date,
  };
}
