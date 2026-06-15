const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Parse a JSON array or newline-delimited JSON trace into normalized events.
 *
 * Expected fields are intentionally small and vendor-neutral:
 * - timestamp: ISO string or epoch milliseconds
 * - type: thought | tool_call | tool_result | error | message | done
 * - tool: optional tool name for tool events
 * - input/output/message/error/duration_ms: optional metadata
 */
export function parseTrace(rawTrace) {
  if (typeof rawTrace !== 'string') {
    throw new TypeError('Trace input must be a string.');
  }

  const trimmed = rawTrace.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const records = trimmed.startsWith('[')
    ? parseJsonArray(trimmed)
    : parseNdjson(trimmed);

  return records.map(normalizeEvent).sort(compareEvents);
}

function parseJsonArray(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON trace must be an array of event objects.');
  }
  return parsed;
}

function parseNdjson(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON on trace line ${index + 1}: ${error.message}`);
      }
    });
}

function normalizeEvent(record, index) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`Trace event ${index + 1} must be an object.`);
  }

  const type = String(record.type ?? '').trim();
  if (type.length === 0) {
    throw new Error(`Trace event ${index + 1} is missing a type.`);
  }

  const timestamp = normalizeTimestamp(record.timestamp, index);
  const durationMs = normalizeOptionalNumber(record.duration_ms ?? record.durationMs, 'duration_ms', index);

  return {
    timestamp,
    type,
    tool: optionalString(record.tool),
    message: optionalString(record.message ?? record.content ?? record.error),
    input: record.input,
    output: record.output,
    durationMs,
    raw: record,
    sequence: index,
  };
}

function normalizeTimestamp(value, index) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }

  throw new Error(`Trace event ${index + 1} has an invalid timestamp.`);
}

function normalizeOptionalNumber(value, fieldName, index) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`Trace event ${index + 1} has an invalid ${fieldName}.`);
  }
  return numberValue;
}

function optionalString(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

function compareEvents(left, right) {
  const byTime = left.timestamp.localeCompare(right.timestamp);
  if (byTime !== 0) {
    return byTime;
  }
  return left.sequence - right.sequence;
}
