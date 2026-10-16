// Gemini CLI: ~/.gemini/tmp/<project-hash>/chats/session-*.json
import { createTimeline } from '../timeline.js';

export const name = 'gemini';
export const label = 'Gemini CLI';

export const detect = (text, file) =>
  file.endsWith('.json') && /"messages"\s*:/.test(text) && /"(projectHash|sessionId)"\s*:/.test(text);

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : p.text ?? '')).join('');
  return content?.text ?? '';
}

function toolResultText(tc) {
  if (typeof tc.resultDisplay === 'string') return tc.resultDisplay;
  const parts = Array.isArray(tc.result) ? tc.result : tc.result ? [tc.result] : [];
  return parts
    .map((p) => {
      const r = p.functionResponse?.response;
      if (r == null) return typeof p === 'string' ? p : '';
      return typeof r.output === 'string' ? r.output : typeof r.error === 'string' ? r.error : JSON.stringify(r);
    })
    .join('\n');
}

export function parse(text) {
  const b = createTimeline(name);
  const doc = JSON.parse(text);

  // Older Gemini CLI logs.json: a flat array that only records user prompts.
  if (Array.isArray(doc)) {
    for (const m of doc) {
      if (m.timestamp) b.stamp(m.timestamp);
      b.setMeta({ sessionId: m.sessionId });
      if (m.type === 'user') b.user(m.message, m.timestamp);
    }
    return b.done();
  }

  b.setMeta({ sessionId: doc.sessionId });
  for (const ts of [doc.startTime, doc.lastUpdated]) if (ts) b.stamp(ts);

  for (const m of doc.messages ?? []) {
    const ts = m.timestamp;
    if (ts) b.stamp(ts);
    if (m.type === 'user') {
      b.user(textOf(m.content), ts);
      continue;
    }
    if (m.type !== 'gemini') continue;

    b.setMeta({ model: m.model });
    let tokens = null;
    if (m.tokens) {
      // Gemini reports cached tokens as a subset of input tokens.
      const cached = m.tokens.cached ?? 0;
      tokens = b.usage({ input: (m.tokens.input ?? 0) - cached, cacheRead: cached, output: (m.tokens.output ?? 0) + (m.tokens.thoughts ?? 0) });
    }
    const take = () => {
      const t = tokens;
      tokens = null;
      return t;
    };
    for (const th of m.thoughts ?? []) {
      b.thinking([th.subject, th.description].filter(Boolean).join(': '), th.timestamp ?? ts, take());
    }
    if (textOf(m.content).trim()) b.assistant(textOf(m.content), ts, take());
    for (const tc of m.toolCalls ?? []) {
      b.toolCall({ id: tc.id, name: tc.displayName ?? tc.name, input: tc.args, ts: tc.timestamp ?? ts, tokens: take() });
      b.toolResult(tc.id, toolResultText(tc), tc.status === 'error' || tc.status === 'cancelled', null);
    }
  }
  return b.done();
}
