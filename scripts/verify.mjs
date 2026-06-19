#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixturePath = join(repoRoot, 'tests/fixtures/agent-run.ndjson');

const checks = [
  {
    name: 'unit tests',
    command: process.execPath,
    args: ['--test', 'tests/*.test.mjs'],
    validate: () => undefined,
  },
  {
    name: 'CLI demo smoke test',
    command: process.execPath,
    args: ['bin/agent-trace.mjs', fixturePath],
    validate: validateDemoReport,
  },
];

for (const check of checks) {
  runCheck(check);
}

console.log('verify: all checks passed');

function runCheck({ name, command, args, validate }) {
  console.log(`verify: ${name}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${name} failed with exit code ${process.exitCode}`);
  }

  validate(result.stdout);
}

function validateDemoReport(report) {
  if (!existsSync(fixturePath)) {
    throw new Error(`Missing smoke-test fixture: ${fixturePath}`);
  }

  const requiredSections = [
    '# Agent Trace Report: agent-run.ndjson',
    '## Tool usage',
    '## Errors',
    '## Timeline highlights',
  ];

  const missingSection = requiredSections.find((section) => !report.includes(section));
  if (missingSection) {
    throw new Error(`CLI demo output is missing ${missingSection}`);
  }
}
