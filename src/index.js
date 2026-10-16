// Public API shared by the CLI, the Claude Code plugin hook, and anyone importing the package.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectAdapter, getAdapter } from './adapters/index.js';
import { redactDeep } from './redact.js';
import { renderHtml } from './render.js';

export { listSessions } from './locate.js';
export { digest } from './digest.js';
export { AGENT_NAMES } from './adapters/index.js';

export const dataDir = () => process.env.AGENT_REPLAY_HOME || path.join(os.homedir(), '.agent-replay');

export function loadSession(file, { agent } = {}) {
  const text = fs.readFileSync(file, 'utf8');
  const adapter = agent ? getAdapter(agent) : detectAdapter(text, file);
  const timeline = adapter.parse(text);
  timeline.meta.source = path.resolve(file);
  // Aider keeps one history file per repo, so key it by path.
  timeline.meta.sessionId ??= crypto.createHash('sha1').update(timeline.meta.source).digest('hex').slice(0, 12);
  return timeline;
}

const slug = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, '-');

export const recapPath = (t) => path.join(dataDir(), 'recaps', `${t.meta.agent}-${slug(t.meta.sessionId)}.json`);

export function defaultOut(t) {
  const when = t.meta.start ? t.meta.start.slice(0, 16).replace(/[-:]/g, '').replace('T', '-') : 'undated';
  return path.join(dataDir(), 'replays', `${t.meta.agent}-${when}-${slug(t.meta.sessionId).slice(0, 8)}.html`);
}

export function readRecap(file) {
  const recap = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!recap || typeof recap !== 'object' || !Array.isArray(recap.sections ?? [])) {
    throw new Error(`${file} is not a recap (expected { type, title, tldr, sections: [{ heading, items }] })`);
  }
  return recap;
}

// Writes the HTML replay. A saved recap for this session is embedded automatically unless one is passed.
export function writeReplay(timeline, { out, title, recap, redact = true, thinking = true } = {}) {
  let t = timeline;
  if (!thinking) t = { ...t, events: t.events.filter((e) => e.kind !== 'thinking') };
  if (recap === undefined) {
    const saved = recapPath(timeline);
    recap = fs.existsSync(saved) ? readRecap(saved) : null;
  }
  if (redact) {
    t = redactDeep(t);
    recap = recap && redactDeep(recap);
  }
  const file = out ?? defaultOut(timeline);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderHtml(t, { title: title ?? recap?.title, recap }));
  return file;
}

const configFile = () => path.join(dataDir(), 'config.json');

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch {
    return { autoReplay: false };
  }
}

export function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2) + '\n');
  return next;
}
