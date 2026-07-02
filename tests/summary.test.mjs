import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTrace } from '../src/parser.mjs';
import { formatSummary, summarizeTrace } from '../src/summary.mjs';

const sample = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"message","message":"Start run"}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"tool_call","tool":"search_files"}
{"timestamp":"2026-01-15T09:00:01.250Z","type":"tool_result","tool":"search_files","duration_ms":250}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_call","tool":"terminal"}
{"timestamp":"2026-01-15T09:00:03.000Z","type":"error","tool":"terminal","error":"Command timed out"}
{"timestamp":"2026-01-15T09:00:04.000Z","type":"done","message":"Recovered with a narrower test command"}
`;

describe('summarizeTrace', () => {
  it('counts tool calls, durations, errors, and milestones', () => {
    const summary = summarizeTrace(parseTrace(sample));

    assert.equal(summary.eventCount, 6);
    assert.equal(summary.totalToolCalls, 2);
    assert.equal(summary.completedToolCalls, 1);
    assert.equal(summary.failedToolCalls, 1);
    assert.equal(summary.totalDurationMs, 250);
    assert.deepEqual(summary.tools.map((tool) => tool.name), ['search_files', 'terminal']);
    assert.equal(summary.errors[0].message, 'Command timed out');
    assert.equal(summary.milestones.length, 2);
  });

  it('does not mark orphan or duplicate tool results as completed calls', () => {
    const noisyTrace = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_result","tool":"terminal","duration_ms":75}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"tool_call","tool":"terminal"}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_result","tool":"terminal","duration_ms":125}
{"timestamp":"2026-01-15T09:00:03.000Z","type":"tool_result","tool":"terminal","duration_ms":50}
{"timestamp":"2026-01-15T09:00:04.000Z","type":"tool_call","tool":"read_file"}
`;

    const summary = summarizeTrace(parseTrace(noisyTrace));

    assert.equal(summary.totalToolCalls, 2);
    assert.equal(summary.completedToolCalls, 1);
    assert.equal(summary.failedToolCalls, 1);
    assert.equal(summary.totalDurationMs, 250);
    assert.deepEqual(summary.tools, [
      { name: 'read_file', calls: 1, results: 0, durationMs: 0 },
      { name: 'terminal', calls: 1, results: 3, durationMs: 250 },
    ]);
  });

  it('detects back-to-back tool calls that repeat the same tool and input', () => {
    const loopingTrace = `
{"timestamp":"2026-01-15T09:00:00.000Z","type":"tool_call","tool":"search_files","input":{"query":"TODO"}}
{"timestamp":"2026-01-15T09:00:00.100Z","type":"tool_result","tool":"search_files","duration_ms":100}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"tool_call","tool":"search_files","input":{"query":"TODO"}}
{"timestamp":"2026-01-15T09:00:01.100Z","type":"tool_result","tool":"search_files","duration_ms":100}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_call","tool":"search_files","input":{"query":"TODO"}}
{"timestamp":"2026-01-15T09:00:02.100Z","type":"tool_result","tool":"search_files","duration_ms":100}
{"timestamp":"2026-01-15T09:00:03.000Z","type":"tool_call","tool":"read_file","input":{"path":"README.md"}}
`;

    const summary = summarizeTrace(parseTrace(loopingTrace));

    assert.deepEqual(summary.repeatedToolCalls, [
      {
        tool: 'search_files',
        input: { query: 'TODO' },
        count: 3,
        firstTimestamp: '2026-01-15T09:00:00.000Z',
        lastTimestamp: '2026-01-15T09:00:02.000Z',
      },
    ]);
  });

  it('does not flag distinct or non-consecutive tool calls as repeats', () => {
    const summary = summarizeTrace(parseTrace(sample));

    assert.deepEqual(summary.repeatedToolCalls, []);
  });
});

describe('formatSummary', () => {
  it('renders a readable Markdown report', () => {
    const report = formatSummary(summarizeTrace(parseTrace(sample)), { title: 'Example Report' });

    assert.match(report, /^# Example Report/);
    assert.match(report, /Tool calls: 1\/2 completed/);
    assert.match(report, /- search_files: 1 call\(s\), 1 result\(s\), 250ms/);
    assert.match(report, /- 2026-01-15T09:00:03.000Z \(terminal\): Command timed out/);
    assert.match(report, /Timeline highlights/);
  });
});
