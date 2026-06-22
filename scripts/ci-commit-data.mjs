/**
 * ci-commit-data.mjs — commit a generated data file from CI, but only when its
 * meaningful content actually changed.
 *
 * The ingest scripts rewrite a fresh `generatedAt` timestamp on every run, so a
 * naive "did the file change?" check would commit daily even when no event data
 * moved. This helper compares the file against HEAD with `generatedAt` stripped,
 * and commits + pushes only on a real diff. Reusable for every data-pipeline job
 * (events, teams, athlete starts, …).
 *
 * Usage: node scripts/ci-commit-data.mjs <file> "<commit message>"
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const file = process.argv[2];
const message = process.argv[3] ?? `chore(data): refresh ${file}`;
if (!file) {
  console.error('usage: node scripts/ci-commit-data.mjs <file> [message]');
  process.exit(1);
}

/** JSON content with the volatile top-level `generatedAt` removed, for comparison. */
const stable = (raw) => {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') delete o.generatedAt;
    return JSON.stringify(o);
  } catch {
    return raw; // non-JSON: compare verbatim
  }
};

const next = stable(readFileSync(file, 'utf8'));
let prev = '';
try {
  prev = stable(execSync(`git show HEAD:${file}`, { encoding: 'utf8' }));
} catch {
  prev = ''; // file is new at this path
}

if (next === prev) {
  console.log(`No content change in ${file} — skipping commit.`);
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('git config user.name "github-actions[bot]"');
run('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
run(`git add ${file}`);
run(`git commit -m ${JSON.stringify(`${message} [skip ci]`)}`);
run('git push');
console.log(`Committed ${file}.`);
