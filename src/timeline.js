// Agent-neutral timeline builder. Every adapter turns its native format into this shape:
// { meta, events: [{ n, kind: user|assistant|thinking|tool, ... }], totals, toolCounts }

export function createTimeline(agent) {
  const meta = { agent, sessionId: null, cwd: null, model: null, version: null, start: null, end: null, source: null };
  const events = [];
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const toolCounts = {};
  const toolsById = new Map();

  // `n` is a stable 1-based step number shared by the HTML page, the digest and recap citations.
  const push = (ev) => {
    ev.n = events.length + 1;
    events.push(ev);
    return ev;
  };

  return {
    setMeta(fields) {
      for (const [k, v] of Object.entries(fields)) if (v != null && meta[k] == null) meta[k] = v;
    },
    stamp(ts) {
      const t = Date.parse(ts);
      if (Number.isNaN(t)) return;
      if (!meta.start || t < Date.parse(meta.start)) meta.start = ts;
      if (!meta.end || t > Date.parse(meta.end)) meta.end = ts;
    },
    usage(u) {
      const tokens = { input: u.input ?? 0, output: u.output ?? 0, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0 };
      for (const k of Object.keys(totals)) totals[k] += tokens[k];
      return tokens;
    },
    setTotals(u) {
      Object.assign(totals, { input: u.input ?? 0, output: u.output ?? 0, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0 });
    },
    user(text, ts) {
      if (text?.trim()) push({ kind: 'user', text, ts });
    },
    assistant(text, ts, tokens = null) {
      if (text?.trim()) push({ kind: 'assistant', text, ts, tokens });
    },
    thinking(text, ts, tokens = null) {
      if (text?.trim()) push({ kind: 'thinking', text, ts, tokens });
    },
    toolCall({ id, name, input, ts, tokens = null }) {
      const ev = push({ kind: 'tool', id, name, input: input ?? {}, ts, tokens, result: null, isError: false });
      if (id) toolsById.set(id, ev);
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
      return ev;
    },
    toolResult(id, text, isError, ts) {
      const ev = toolsById.get(id);
      if (!ev) return;
      ev.result = text;
      ev.isError = !!isError;
      if (ev.ts && ts) ev.durationMs = Date.parse(ts) - Date.parse(ev.ts);
    },
    done() {
      return { meta, events, totals, toolCounts };
    },
  };
}

export function parseJsonl(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip partial lines (e.g. a session still being written).
    }
  }
  return entries;
}

export function tryJson(s) {
  if (typeof s !== 'string') return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
