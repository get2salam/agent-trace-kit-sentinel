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

  it('penalizes and flags traces stuck retrying the same tool call', () => {
    const loopingRun = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_call","tool":"terminal","input":{"command":"npm test"}}
{"timestamp":"2026-01-15T09:00:00.100Z","type":"tool_result","tool":"terminal","duration_ms":100}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"tool_call","tool":"terminal","input":{"command":"npm test"}}
{"timestamp":"2026-01-15T09:00:01.100Z","type":"tool_result","tool":"terminal","duration_ms":100}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_call","tool":"terminal","input":{"command":"npm test"}}
{"timestamp":"2026-01-15T09:00:02.100Z","type":"tool_result","tool":"terminal","duration_ms":100}
`;

    const health = evaluateTraceHealth(summarizeTrace(parseTrace(loopingRun)), { latencyBudgetMs: 1000 });

    assert.deepEqual(health.flags, ['terminal repeated 3x in a row (possible stuck loop)']);
    assert.equal(health.score, 69);
    assert.equal(health.grade, 'investigate');
  });

  it('respects a custom loopThreshold when scoring repeated calls', () => {
    const twoCallRun = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_call","tool":"terminal","input":{"command":"npm test"}}
{"timestamp":"2026-01-15T09:00:00.100Z","type":"tool_result","tool":"terminal","duration_ms":100}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"tool_call","tool":"terminal","input":{"command":"npm test"}}
{"timestamp":"2026-01-15T09:00:01.100Z","type":"tool_result","tool":"terminal","duration_ms":100}
`;

    const health = evaluateTraceHealth(summarizeTrace(parseTrace(twoCallRun)), {
      latencyBudgetMs: 1000,
      loopThreshold: 2,
    });

    assert.deepEqual(health.flags, ['terminal repeated 2x in a row (possible stuck loop)']);
  });

  it('formats a compact health summary for reports and CI logs', () => {
    const health = evaluateTraceHealth(summarizeTrace(parseTrace(cleanRun)), { latencyBudgetMs: 1000 });

    assert.equal(
      formatTraceHealth(health),
      'Trace health: 95/100 (stable)\nCompletion rate: 100%\nFlags: none',
    );
  });
});
