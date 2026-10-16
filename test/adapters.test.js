import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectAdapter } from '../src/adapters/index.js';
import { loadSession } from '../src/index.js';

const ex = (f) => new URL(`../examples/${f}`, import.meta.url).pathname;
const tools = (t) => t.events.filter((e) => e.kind === 'tool');

test('auto-detects each agent format', () => {
  for (const [file, agent] of [['claude.jsonl', 'claude'], ['codex.jsonl', 'codex'], ['gemini.json', 'gemini'], ['aider.md', 'aider']]) {
    assert.equal(detectAdapter(fs.readFileSync(ex(file), 'utf8'), ex(file)).name, agent, file);
  }
});

test('claude: pairs results with calls and counts usage once per message', () => {
  const t = loadSession(ex('claude.jsonl'));
  assert.equal(tools(t).length, 4);
  assert.equal(tools(t)[0].isError, true);
  assert.equal(tools(t)[0].durationMs, 6500);
  assert.deepEqual(t.toolCounts, { Bash: 2, Read: 1, Edit: 1 });
  assert.equal(t.totals.output, 295);
  assert.equal(t.meta.model, 'claude-opus-5-5');
  assert.deepEqual(t.events.map((e) => e.n), t.events.map((_, i) => i + 1));
});

test('codex: skips injected context, parses shell/patch calls, exit codes and totals', () => {
  const t = loadSession(ex('codex.jsonl'));
  assert.equal(t.meta.sessionId, '0199-codex-demo');
  assert.equal(t.meta.model, 'gpt-5-codex');
  assert.equal(t.events.filter((e) => e.kind === 'user').length, 1);
  const [curl, patch] = tools(t);
  assert.equal(curl.isError, true);
  assert.match(curl.result, /Failed to connect/);
  assert.equal(patch.name, 'apply_patch');
  assert.equal(patch.isError, false);
  assert.deepEqual(t.totals, { input: 3000, output: 400, cacheRead: 6000, cacheWrite: 0 });
});

test('gemini: thoughts, tool calls with inline results, error status', () => {
  const t = loadSession(ex('gemini.json'));
  assert.equal(t.events.filter((e) => e.kind === 'thinking').length, 1);
  const [read, shell] = tools(t);
  assert.match(read.result, /sourcemap: true/);
  assert.equal(shell.isError, true);
  assert.equal(t.totals.cacheRead, 8000);
});

test('aider: prompts, replies, output blocks and token lines', () => {
  const t = loadSession(ex('aider.md'));
  assert.equal(t.meta.model, 'claude-sonnet-5-5');
  assert.deepEqual(t.events.filter((e) => e.kind === 'user').map((e) => e.text), ['add input validation to signup()', 'run the tests']);
  assert.match(t.events.find((e) => e.kind === 'assistant').text, /SEARCH/);
  assert.deepEqual(t.totals, { input: 2400, output: 180, cacheRead: 1100, cacheWrite: 0 });
  assert.equal(tools(t).at(-1).isError, true);
});
