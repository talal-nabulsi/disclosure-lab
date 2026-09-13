import { readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../lib/backtest.ts';
import { runComparison } from '../lib/comparison.ts';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run compare -- [--config exported-or-config.json] [--output comparison.json]',
  );
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2)
  if (!['--config', '--output'].includes(args[i]) || !args[i + 1])
    throw Error('Expected --config FILE or --output FILE');
const flags = Object.fromEntries(
  Array.from({ length: args.length / 2 }, (_, i) => [
    args[i * 2],
    args[i * 2 + 1],
  ]),
);
const snapshot = JSON.parse(
  await readFile(
    new URL('../public/data/snapshot.json', import.meta.url),
    'utf8',
  ),
);
const supplied = flags['--config']
  ? JSON.parse(await readFile(flags['--config'], 'utf8'))
  : {};
const config = {
  ...DEFAULT_CONFIG,
  to: snapshot.manifest.asOf,
  ...(supplied.config || supplied),
};
const comparison = runComparison(snapshot, config);
console.table(
  comparison.rows.map(({ member, result }) => ({
    politician: member.name,
    purchases: result.disclosure.positions.length,
    afterDisclosure: `${result.disclosure.totalReturn.toFixed(2)}%`,
    tradeDateEstimate: `${result.transaction.totalReturn.toFixed(2)}%`,
  })),
);
console.log(
  `${comparison.rows.length} independent portfolios; ${comparison.from} through ${comparison.to}; filing dates are availability proxies.`,
);
if (flags['--output'])
  await writeFile(
    flags['--output'],
    JSON.stringify(
      {
        engineVersion: '1.0.0',
        manifest: snapshot.manifest,
        config,
        comparison,
      },
      null,
      2,
    ),
  );
