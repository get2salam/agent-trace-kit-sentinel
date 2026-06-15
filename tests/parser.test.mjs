import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTrace } from '../src/parser.mjs';

const ndjson = `
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_call","tool":"terminal"}
{"timestamp":"2026-01-15T09:00:01.000Z","type":"message","message":"Start"}
`;

describe('parseTrace', () => {
  it('parses NDJSON and sorts events by timestamp', () => {
    const events = parseTrace(ndjson);

    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'message');
    assert.equal(events[1].tool, 'terminal');
  });

  it('parses JSON arrays and normalizes duration aliases', () => {
    const events = parseTrace(JSON.stringify([
      {
        timestamp: 1768467600000,
        type: 'tool_result',
        tool: 'read_file',
        durationMs: '42',
      },
    ]));

    assert.equal(events[0].timestamp, '2026-01-15T09:00:00.000Z');
    assert.equal(events[0].durationMs, 42);
  });

  it('throws useful errors for malformed lines', () => {
    assert.throws(
      () => parseTrace('{"timestamp":"2026-01-15T09:00:00.000Z","type":"message"}\nnot-json'),
      /Invalid JSON on trace line 2/,
    );
  });

  it('rejects events without a valid timestamp', () => {
    assert.throws(
      () => parseTrace('{"type":"message","message":"missing time"}'),
      /invalid timestamp/,
    );
  });
});
