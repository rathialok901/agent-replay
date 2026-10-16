// Compact plain-text view of a session, sized for a model to read and recap.
import { agentLabel } from './adapters/index.js';
import { toolSummary } from './summary.js';

const oneLine = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ⏎ ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n) + `… (+${s.length - n} chars)` : s);

// Progressively tighter limits, tried in order until the digest fits.
const LEVELS = [
  { user: 3000, agent: 1500, result: 600 },
  { user: 1500, agent: 600, result: 200 },
  { user: 800, agent: 300, result: 80 },
];

function eventLines(events, lim, thinking) {
  const out = [];
  for (const e of events) {
    if (e.kind === 'user') out.push(`[#${e.n}] USER: ${clip(e.text.trim(), lim.user)}`);
    else if (e.kind === 'assistant') out.push(`[#${e.n}] AGENT: ${clip(e.text.trim(), lim.agent)}`);
    else if (e.kind === 'thinking' && thinking) out.push(`[#${e.n}] THINKING: ${clip(oneLine(e.text), lim.agent)}`);
    else if (e.kind === 'tool') {
      const res = e.result == null ? '(no result)' : clip(oneLine(e.result), lim.result);
      out.push(`[#${e.n}] TOOL ${e.name}: ${toolSummary(e.input)}\n      ${e.isError ? '✗ ERROR' : '→'} ${res}`);
    }
  }
  return out;
}

const size = (lines) => lines.reduce((n, l) => n + l.length + 1, 0);

export function digest({ meta, events, totals }, { maxChars = 60000, thinking = false } = {}) {
  const tools = events.filter((e) => e.kind === 'tool');
  const header = [
    `# Session digest — ${agentLabel(meta.agent)}`,
    meta.model && `model: ${meta.model}`,
    meta.cwd && `cwd: ${meta.cwd}`,
    meta.start && `time: ${meta.start} → ${meta.end}`,
    `events: ${events.length} · tool calls: ${tools.length} · failed: ${tools.filter((e) => e.isError).length}`,
    `tokens: ${totals.input + totals.cacheRead + totals.cacheWrite} in (${totals.cacheRead} cached) · ${totals.output} out`,
    `Cite steps as [#n].`,
  ]
    .filter(Boolean)
    .join('\n');

  let body;
  for (const lim of LEVELS) {
    body = eventLines(events, lim, thinking);
    if (size(body) <= maxChars) break;
  }
  if (size(body) > maxChars) {
    // Still too long: keep the opening (the goal) and the ending (the outcome).
    let i = 0;
    let used = 0;
    while (i < body.length && used + body[i].length < maxChars * 0.3) used += body[i++].length + 1;
    let j = body.length;
    used = 0;
    while (j > i && used + body[j - 1].length < maxChars * 0.7) used += body[--j].length + 1;
    body = [...body.slice(0, i), `… ${j - i} entries omitted for length …`, ...body.slice(j)];
  }
  return `${header}\n\n${body.join('\n')}`;
}
