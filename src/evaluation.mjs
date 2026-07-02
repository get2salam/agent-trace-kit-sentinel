export function evaluateTraceHealth(summary, options = {}) {
  if (summary === null || typeof summary !== 'object') {
    throw new TypeError('Trace summary must be an object.');
  }

  const totalToolCalls = Math.max(0, Number(summary.totalToolCalls ?? 0));
  const completedToolCalls = Math.max(0, Number(summary.completedToolCalls ?? 0));
  const failedToolCalls = Math.max(0, Number(summary.failedToolCalls ?? 0));
  const errorCount = Array.isArray(summary.errors) ? summary.errors.length : 0;
  const totalDurationMs = Math.max(0, Number(summary.totalDurationMs ?? 0));
  const latencyBudgetMs = Math.max(1, Number(options.latencyBudgetMs ?? 5000));
  const loopThreshold = Math.max(2, Number(options.loopThreshold ?? 3));
  const stuckLoops = Array.isArray(summary.repeatedToolCalls)
    ? summary.repeatedToolCalls.filter((group) => group.count >= loopThreshold)
    : [];

  const completionRate = totalToolCalls === 0
    ? 1
    : Math.min(1, completedToolCalls / totalToolCalls);
  const latencyRate = Math.max(0, 1 - totalDurationMs / latencyBudgetMs);
  const reliabilityBonus = failedToolCalls === 0 && errorCount === 0 && stuckLoops.length === 0 ? 10 : 0;
  const score = clampScore(
    Math.round(
      (completionRate * 70) + (latencyRate * 20) + reliabilityBonus
      - (errorCount * 8) - (stuckLoops.length * 15),
    ),
  );

  return {
    score,
    grade: gradeScore(score),
    completionRate,
    latencyBudgetMs,
    flags: buildFlags({ failedToolCalls, errorCount, totalDurationMs, latencyBudgetMs, stuckLoops }),
  };
}

export function formatTraceHealth(evaluation) {
  const flags = evaluation.flags.length === 0
    ? 'none'
    : evaluation.flags.join(', ');

  return [
    `Trace health: ${evaluation.score}/100 (${evaluation.grade})`,
    `Completion rate: ${formatPercent(evaluation.completionRate)}`,
    `Flags: ${flags}`,
  ].join('\n');
}

function buildFlags({ failedToolCalls, errorCount, totalDurationMs, latencyBudgetMs, stuckLoops }) {
  const flags = [];
  if (failedToolCalls > 0) {
    flags.push(`${failedToolCalls} failed tool call(s)`);
  }
  if (errorCount > 0) {
    flags.push(`${errorCount} error event(s)`);
  }
  if (totalDurationMs > latencyBudgetMs) {
    flags.push(`tool time exceeded ${latencyBudgetMs}ms budget`);
  }
  for (const loop of stuckLoops ?? []) {
    flags.push(`${loop.tool} repeated ${loop.count}x in a row (possible stuck loop)`);
  }
  return flags;
}

function gradeScore(score) {
  if (score >= 90) {
    return 'stable';
  }
  if (score >= 70) {
    return 'watch';
  }
  return 'investigate';
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}
