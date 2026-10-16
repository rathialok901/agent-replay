// OpenAI Codex CLI: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
import { createTimeline, parseJsonl, tryJson } from '../timeline.js';

export const name = 'codex';
export const label = 'Codex CLI';

export const detect = (text, file) =>
  /rollout-[^/\\]*\.jsonl$/.test(file) || /"type"\s*:\s*"(session_meta|response_item|turn_context)"/.test(text.slice(0, 20000));

// Codex injects environment/instruction blocks as user messages; they aren't prompts.
const INJECTED = /^\s*<(environment_context|user_instructions|user_shell_command)\b/;

const contentText = (content) =>
  typeof content === 'string' ? content : (content ?? []).map((c) => c.text ?? '').join('\n');

function outputOf(raw) {
  const parsed = tryJson(raw);
  if (parsed && typeof parsed === 'object' && 'output' in parsed) {
    const code = parsed.metadata?.exit_code;
    return { text: String(parsed.output ?? ''), isError: code != null && code !== 0 };
  }
  return { text: typeof raw === 'string' ? raw : JSON.stringify(raw), isError: false };
}

export function parse(text) {
  const b = createTimeline(name);
  let lastTotal = null;

  for (const line of parseJsonl(text)) {
    const ts = line.timestamp;
    if (ts) b.stamp(ts);

    if (line.type === 'session_meta') {
      const p = line.payload ?? {};
      b.setMeta({ sessionId: p.id, cwd: p.cwd, version: p.cli_version });
      if (p.timestamp) b.stamp(p.timestamp);
      continue;
    }
    if (line.type === 'turn_context') {
      b.setMeta({ model: line.payload?.model, cwd: line.payload?.cwd });
      continue;
    }
    if (line.type === 'event_msg') {
      const info = line.payload?.type === 'token_count' ? line.payload.info : null;
      if (info?.total_token_usage) lastTotal = info.total_token_usage;
      continue;
    }
    // Older rollouts: a bare header line, then response items without a wrapper.
    if (!line.type && line.id) {
      b.setMeta({ sessionId: line.id });
      continue;
    }

    const item = line.type === 'response_item' ? line.payload : line;
    switch (item?.type) {
      case 'message': {
        const body = contentText(item.content);
        if (item.role === 'user' && !INJECTED.test(body)) b.user(body, ts);
        else if (item.role === 'assistant') b.assistant(body, ts);
        break;
      }
      case 'reasoning':
        b.thinking((item.summary ?? []).map((s) => s.text ?? '').join('\n'), ts);
        break;
      case 'function_call':
        b.toolCall({ id: item.call_id, name: item.name, input: tryJson(item.arguments), ts });
        break;
      case 'custom_tool_call':
        b.toolCall({ id: item.call_id, name: item.name, input: { input: item.input }, ts });
        break;
      case 'local_shell_call':
        b.toolCall({ id: item.call_id, name: 'shell', input: item.action ?? {}, ts });
        break;
      case 'function_call_output':
      case 'custom_tool_call_output':
      case 'local_shell_call_output': {
        const { text: out, isError } = outputOf(item.output);
        b.toolResult(item.call_id, out, isError, ts);
        break;
      }
    }
  }

  if (lastTotal) {
    // OpenAI reports cached tokens as a subset of input tokens.
    const cached = lastTotal.cached_input_tokens ?? 0;
    b.setTotals({ input: (lastTotal.input_tokens ?? 0) - cached, cacheRead: cached, output: lastTotal.output_tokens ?? 0 });
  }
  return b.done();
}
