import * as aider from './aider.js';
import * as claude from './claude.js';
import * as codex from './codex.js';
import * as gemini from './gemini.js';

// Detection order matters: claude is the JSONL fallback, so it goes last.
export const ADAPTERS = [aider, gemini, codex, claude];
export const AGENT_NAMES = ADAPTERS.map((a) => a.name);

export function getAdapter(agent) {
  const a = ADAPTERS.find((x) => x.name === agent);
  if (!a) throw new Error(`Unknown agent "${agent}". Supported: ${AGENT_NAMES.join(', ')}`);
  return a;
}

export function detectAdapter(text, file) {
  const a = ADAPTERS.find((x) => x.detect(text, file));
  if (!a) throw new Error(`Could not tell which agent wrote ${file}. Pass --agent ${AGENT_NAMES.join('|')}`);
  return a;
}

export const agentLabel = (agent) => ADAPTERS.find((a) => a.name === agent)?.label ?? agent;
