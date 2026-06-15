# Agent Trace Kit Sentinel

Small observability toolkit for turning autonomous-agent tool traces into human-readable run reports.

## Problem

Autonomous agents often leave behind long streams of JSON tool calls, tool results, thoughts, errors, and final messages. Those traces are useful for debugging, but they are hard to scan during code review or incident triage.

Agent Trace Kit Sentinel parses lightweight JSON/NDJSON traces and produces a concise Markdown report with the run window, tool usage, latency totals, failures, and timeline highlights.

## Features

- Parses newline-delimited JSON and JSON array trace files.
- Normalizes timestamps, tool names, messages, and duration fields.
- Summarizes completed vs. failed tool calls.
- Aggregates observed tool runtime per tool.
- Formats a clean Markdown run report for humans.
- Ships with deterministic `node:test` coverage and a GitHub Actions workflow.
- Uses only Node.js built-ins: no runtime dependencies.

## Project structure

```text
agent-trace-kit-sentinel/
├── bin/agent-trace.mjs           # CLI entrypoint
├── src/parser.mjs                # Trace parser and validation
├── src/summary.mjs               # Summary model and Markdown formatter
├── src/index.mjs                 # Public module exports
├── tests/fixtures/agent-run.ndjson
├── tests/*.test.mjs              # node:test coverage
└── .github/workflows/test.yml    # CI
```

## Quickstart

Requirements: Node.js 20 or newer.

```bash
npm test
npm run demo
```

Run the CLI against your own local trace:

```bash
node bin/agent-trace.mjs path/to/trace.ndjson
```

## Trace format

Each event is a JSON object. Files can be NDJSON, one event per line, or a JSON array.

Supported event fields:

- `timestamp`: ISO timestamp or epoch milliseconds.
- `type`: event kind such as `message`, `thought`, `tool_call`, `tool_result`, `error`, or `done`.
- `tool`: optional tool name for tool events.
- `message`, `content`, or `error`: human-readable narrative text.
- `duration_ms` or `durationMs`: optional non-negative tool result duration.
- `input` / `output`: optional metadata preserved on parsed events.

## Example input

```json
{"timestamp":"2026-01-15T09:00:00.000Z","type":"message","message":"User asked for a dependency audit."}
{"timestamp":"2026-01-15T09:00:02.000Z","type":"tool_call","tool":"read_file","input":{"path":"package.json"}}
{"timestamp":"2026-01-15T09:00:02.180Z","type":"tool_result","tool":"read_file","duration_ms":180,"output":{"bytes":932}}
{"timestamp":"2026-01-15T09:00:05.000Z","type":"done","message":"Audit completed and tests passed."}
```

## Example output

```markdown
# Agent Trace Report: agent-run.ndjson

Window: 2026-01-15T09:00:00.000Z → 2026-01-15T09:00:05.000Z
Events: 7
Tool calls: 2/2 completed
Observed tool time: 1.60s

## Tool usage
- read_file: 1 call(s), 1 result(s), 180ms
- terminal: 1 call(s), 1 result(s), 1.42s

## Errors
- None recorded.

## Timeline highlights
- 2026-01-15T09:00:00.000Z [message] User asked for a dependency audit.
- 2026-01-15T09:00:01.000Z [thought] Inspect package metadata before changing files.
- 2026-01-15T09:00:05.000Z [done] Audit completed and tests passed.
```

## Verification

```bash
npm test
```

The test suite covers parser validation, NDJSON and JSON-array input, summary aggregation, error reporting, and Markdown formatting.

## License

MIT
