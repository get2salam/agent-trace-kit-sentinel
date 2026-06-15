export function summarizeTrace(events) {
  const sorted = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const toolStats = new Map();
  const errors = [];
  const milestones = [];
  let totalToolCalls = 0;
  let completedToolCalls = 0;
  let totalDurationMs = 0;

  for (const event of sorted) {
    if (event.type === 'tool_call' && event.tool) {
      totalToolCalls += 1;
      ensureTool(toolStats, event.tool).calls += 1;
    }

    if (event.type === 'tool_result' && event.tool) {
      completedToolCalls += 1;
      const stat = ensureTool(toolStats, event.tool);
      stat.results += 1;
      if (typeof event.durationMs === 'number') {
        stat.durationMs += event.durationMs;
        totalDurationMs += event.durationMs;
      }
    }

    if (event.type === 'error') {
      errors.push({
        timestamp: event.timestamp,
        tool: event.tool,
        message: event.message ?? 'Unknown error',
      });
    }

    if (['thought', 'message', 'done'].includes(event.type) && event.message) {
      milestones.push({
        timestamp: event.timestamp,
        type: event.type,
        message: event.message,
      });
    }
  }

  return {
    eventCount: sorted.length,
    startedAt: sorted.at(0)?.timestamp,
    endedAt: sorted.at(-1)?.timestamp,
    totalToolCalls,
    completedToolCalls,
    failedToolCalls: Math.max(totalToolCalls - completedToolCalls, errors.length),
    totalDurationMs,
    tools: [...toolStats.entries()]
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((left, right) => right.calls - left.calls || left.name.localeCompare(right.name)),
    errors,
    milestones,
  };
}

export function formatSummary(summary, options = {}) {
  const title = options.title ?? 'Agent Trace Report';
  const lines = [
    `# ${title}`,
    '',
    `Window: ${summary.startedAt ?? 'n/a'} → ${summary.endedAt ?? 'n/a'}`,
    `Events: ${summary.eventCount}`,
    `Tool calls: ${summary.completedToolCalls}/${summary.totalToolCalls} completed`,
    `Observed tool time: ${formatDuration(summary.totalDurationMs)}`,
    '',
    '## Tool usage',
  ];

  if (summary.tools.length === 0) {
    lines.push('- No tool activity recorded.');
  } else {
    for (const tool of summary.tools) {
      lines.push(`- ${tool.name}: ${tool.calls} call(s), ${tool.results} result(s), ${formatDuration(tool.durationMs)}`);
    }
  }

  lines.push('', '## Errors');
  if (summary.errors.length === 0) {
    lines.push('- None recorded.');
  } else {
    for (const error of summary.errors) {
      const scope = error.tool ? ` (${error.tool})` : '';
      lines.push(`- ${error.timestamp}${scope}: ${error.message}`);
    }
  }

  lines.push('', '## Timeline highlights');
  const highlights = summary.milestones.slice(0, options.maxHighlights ?? 6);
  if (highlights.length === 0) {
    lines.push('- No narrative milestones recorded.');
  } else {
    for (const item of highlights) {
      lines.push(`- ${item.timestamp} [${item.type}] ${item.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function ensureTool(toolStats, name) {
  if (!toolStats.has(name)) {
    toolStats.set(name, { calls: 0, results: 0, durationMs: 0 });
  }
  return toolStats.get(name);
}

function formatDuration(ms) {
  if (!ms) {
    return '0ms';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
