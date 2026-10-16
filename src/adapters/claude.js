// Claude Code: ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
import { createTimeline, parseJsonl } from '../timeline.js';

export const name = 'claude';
export const label = 'Claude Code';

// Fallback adapter: anything JSONL that no other adapter claims.
export const detect = (text, file) => file.endsWith('.jsonl');

function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '[image]' : '')).join('\n');
}

export function parse(text) {
  const b = createTimeline(name);
  // Streaming writes one entry per content block with the same message id; count usage once.
  const seenMessageIds = new Set();

  for (const e of parseJsonl(text)) {
    if (e.isSidechain) continue;
    if (e.timestamp) b.stamp(e.timestamp);
    b.setMeta({ sessionId: e.sessionId, cwd: e.cwd, version: e.version });

    if (e.type === 'user' && e.message) {
      const { content } = e.message;
      if (typeof content === 'string') {
        if (!e.isMeta) b.user(content, e.timestamp);
        continue;
      }
      for (const block of content ?? []) {
        if (block.type === 'text' && !e.isMeta) b.user(block.text, e.timestamp);
        else if (block.type === 'tool_result') b.toolResult(block.tool_use_id, resultText(block.content), block.is_error, e.timestamp);
      }
    }

    if (e.type === 'assistant' && e.message) {
      const msg = e.message;
      b.setMeta({ model: msg.model });
      let tokens = null;
      if (msg.usage && !seenMessageIds.has(msg.id)) {
        if (msg.id) seenMessageIds.add(msg.id);
        tokens = b.usage({
          input: msg.usage.input_tokens,
          output: msg.usage.output_tokens,
          cacheRead: msg.usage.cache_read_input_tokens,
          cacheWrite: msg.usage.cache_creation_input_tokens,
        });
      }
      for (const block of msg.content ?? []) {
        if (block.type === 'text') b.assistant(block.text, e.timestamp, tokens);
        else if (block.type === 'thinking') b.thinking(block.thinking, e.timestamp, tokens);
        else if (block.type === 'tool_use') b.toolCall({ id: block.id, name: block.name, input: block.input, ts: e.timestamp, tokens });
        else continue;
        tokens = null; // attach usage to the first rendered block only
      }
    }
  }
  return b.done();
}
