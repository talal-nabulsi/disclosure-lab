import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './build.mjs';

// Run from the isolated bundle so Firebase never uploads the repository/cache.
const result = spawnSync(
  'firebase',
  [
    'deploy',
    '--project',
    'startupdb-app',
    '--only',
    'apphosting:disclosure-lab',
    ...process.argv.slice(2),
  ],
  {
    cwd: fileURLToPath(new URL('../.firebase-disclosure', import.meta.url)),
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
