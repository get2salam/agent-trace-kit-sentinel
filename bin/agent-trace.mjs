#!/usr/bin/env node
import { basename } from 'node:path';
import { reportFromFile } from '../src/index.mjs';

const [, scriptPath, tracePath] = process.argv;

if (!tracePath || tracePath === '--help' || tracePath === '-h') {
  console.log(`Usage: ${basename(scriptPath)} <trace.ndjson|trace.json>`);
  console.log('Reads a local agent trace and prints a Markdown run report.');
  process.exit(tracePath ? 0 : 1);
}

try {
  const report = await reportFromFile(tracePath, { title: `Agent Trace Report: ${basename(tracePath)}` });
  process.stdout.write(report);
} catch (error) {
  console.error(`agent-trace: ${error.message}`);
  process.exit(1);
}
