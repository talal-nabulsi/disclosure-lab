import { readFile, writeFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, runExperiment } from '../lib/backtest.ts';

// npm run research -- --config experiment.json --output results.json
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'Usage: npm run research -- [--config settings.json] [--snapshot path.json] [--output results.json]',
  );
  process.exit(0);
}
const flags = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--config', '--snapshot', '--output'].includes(args[i]) || !args[i + 1])
    throw Error(`Invalid argument: ${args[i]}`);
  flags.set(args[i], args[i + 1]);
}
const snapshotPath =
  flags.get('--snapshot') ||
  new URL('../public/data/snapshot.json', import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const input = flags.has('--config')
  ? JSON.parse(await readFile(flags.get('--config'), 'utf8'))
  : {};
const config = {
  ...DEFAULT_CONFIG,
  to: snapshot.manifest.asOf,
  ...(input.config || input),
};
const results = runExperiment(snapshot, config);
const payload = {
  engineVersion: '1.0.0',
  manifest: snapshot.manifest,
  config,
  results,
};
if (flags.has('--output'))
  await writeFile(flags.get('--output'), JSON.stringify(payload, null, 2));
console.log(
  JSON.stringify(
    {
      config,
      transactionReturn: results.transaction.totalReturn,
      disclosureReturn: results.disclosure.totalReturn,
      benchmarkReturn: results.benchmarkReturn,
      executedPublicPurchases: results.disclosure.positions.length,
      exclusions: results.disclosure.skipped.length,
      output:
        flags.get('--output') ||
        'Summary only; pass --output to save full audit',
    },
    null,
    2,
  ),
);
