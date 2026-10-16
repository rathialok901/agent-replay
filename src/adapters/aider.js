// Aider: <repo>/.aider.chat.history.md
// Markdown log: "#### " lines are prompts, "> " lines are tool/system output, the rest is the model's reply.
import { createTimeline } from '../timeline.js';

export const name = 'aider';
export const label = 'Aider';

export const detect = (text, file) => file.endsWith('.md') && text.includes('# aider chat started at');

const num = (s) => (s.endsWith('k') ? parseFloat(s) * 1000 : parseFloat(s));

export function parse(text) {
  const b = createTimeline(name);
  let ts = null;
  let kind = null;
  let buf = [];
  let toolSeq = 0;

  const flush = () => {
    const body = buf.join('\n').trim();
    if (body) {
      if (kind === 'user') b.user(body, ts);
      else if (kind === 'assistant') b.assistant(body, ts);
      else if (kind === 'output') {
        const id = `aider-${++toolSeq}`;
        const isError = /^(error|traceback|failed)/im.test(body);
        b.toolCall({ id, name: 'aider', input: { summary: body.split('\n')[0] }, ts });
        b.toolResult(id, body, isError, null);
      }
    }
    kind = null;
    buf = [];
  };
  const add = (k, line) => {
    if (kind !== k) flush();
    kind = k;
    buf.push(line);
  };

  for (const line of text.split('\n')) {
    const started = line.match(/^# aider chat started at (.+)$/);
    if (started) {
      flush();
      const d = new Date(started[1].trim().replace(' ', 'T'));
      ts = Number.isNaN(d.getTime()) ? null : d.toISOString();
      if (ts) b.stamp(ts);
      continue;
    }
    const prompt = line.match(/^#### ?(.*)$/);
    if (prompt) {
      add('user', prompt[1]);
      continue;
    }
    const out = line.match(/^> ?(.*)$/);
    if (out) {
      const o = out[1];
      const model = o.match(/^Model: (\S+)/);
      if (model) b.setMeta({ model: model[1] });
      const version = o.match(/^Aider v(\S+)/);
      if (version) b.setMeta({ version: version[1] });
      const tok = o.match(/Tokens: ([\d.]+k?) sent(?:, ([\d.]+k?) cache write)?(?:, ([\d.]+k?) cache hit)?, ([\d.]+k?) received/);
      if (tok) {
        b.usage({ input: num(tok[1]), cacheWrite: tok[2] ? num(tok[2]) : 0, cacheRead: tok[3] ? num(tok[3]) : 0, output: num(tok[4]) });
        continue;
      }
      add('output', o);
      continue;
    }
    if (kind === 'user' && !line.trim()) {
      flush();
      continue;
    }
    if (kind === null && !line.trim()) continue;
    add(kind === 'output' && !line.trim() ? 'output' : 'assistant', line);
  }
  flush();
  return b.done();
}
