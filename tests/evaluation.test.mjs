import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateTraceHealth, formatTraceHealth } from '../src/evaluation.mjs';
import { parseTrace } from '../src/parser.mjs';
import { summarizeTrace } from '../src/summary.mjs';

const cleanRun = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_call","tool":"read_file"}
{"timestamp":"2026-01-15T09:00:00.250Z","type":"tool_result","tool":"read_file","duration_ms":250}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"done","message":"Finished safely"}
`;

const riskyRun = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_call","tool":"terminal"}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"error","tool":"terminal","error":"Command timed out"}
{"timestamp":"2026-01-15T09:00:03.000Z","type":"tool_call","tool":"search_files"}
{"timestamp":"2026-01-15T09:00:04.500Z","type":"tool_result","tool":"search_files","duration_ms":4500}
`;

describe('evaluateTraceHealth', () => {
  it('scores clean traces as stable with no flags', () => {
    const health = evaluateTraceHealth(summarizeTrace(parseTrace(cleanRun)), { latencyBudgetMs: 1000 });

    assert.equal(health.score, 95);
    assert.equal(health.grade, 'stable');
    assert.equal(health.completionRate, 1);
    assert.deepEqual(health.flags, []);
  });

  it('flags incomplete, erroring, and slow agent traces', () => {
    const health = evaluateTraceHealth(summarizeTrace(parseTrace(riskyRun)), { latencyBudgetMs: 1000 });

    assert.equal(health.grade, 'investigate');
    assert.deepEqual(health.flags, [
      '1 failed tool call(s)',
      '1 error event(s)',
      'tool time exceeded 1000ms budget',
    ]);
  });

  it('formats a compact health summary for reports and CI logs', () => {
    const health = evaluateTraceHealth(summarizeTrace(parseTrace(cleanRun)), { latencyBudgetMs: 1000 });

    assert.equal(
      formatTraceHealth(health),
      'Trace health: 95/100 (stable)\nCompletion rate: 100%\nFlags: none',
    );
  });
});
