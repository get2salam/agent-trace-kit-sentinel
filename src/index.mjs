import { readFile } from 'node:fs/promises';
import { parseTrace } from './parser.mjs';
import { formatSummary, summarizeTrace } from './summary.mjs';

export async function reportFromFile(path, options = {}) {
  const rawTrace = await readFile(path, 'utf8');
  const events = parseTrace(rawTrace);
  const summary = summarizeTrace(events);
  return formatSummary(summary, options);
}

export { parseTrace, summarizeTrace, formatSummary };
