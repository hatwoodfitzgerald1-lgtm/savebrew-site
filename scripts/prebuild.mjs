// Runs before every `astro build`. In the sandbox the copy, long form and product UI sources exist and the data
// step regenerates src/data from them; on Webflow Cloud (and any clone) those sources are absent and the committed
// src/data files are the record, so the data step is skipped and only the repo's own checks run.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const copyDir = process.env.SB_COPY_DIR || '/home/claude/savebrew/spec/copy';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
if (fs.existsSync(copyDir)) {
  run('npm run data');
} else {
  console.log('prebuild: source folders absent, using the committed src/data (data step skipped)');
}
run('node scripts/check-width.mjs');
run('node scripts/check-dashes.mjs');
