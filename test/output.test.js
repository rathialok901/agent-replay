import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { digest, listSessions, loadSession } from '../src/index.js';
import { redactDeep } from '../src/redact.js';
import { renderHtml } from '../src/render.js';
import { createTimeline } from '../src/timeline.js';

const ex = (f) => new URL(`../examples/${f}`, import.meta.url).pathname;
const bin = new URL('../bin/agent-replay.js', import.meta.url).pathname;

test('redacts secrets', () => {
  assert.doesNotMatch(JSON.stringify(redactDeep(loadSession(ex('claude.jsonl')))), /sk-ant-api03/);
});

test('escapes HTML in content and recap', () => {
  const b = createTimeline('claude');
  b.user('<script>alert(1)</script>');
  const html = renderHtml(b.done(), { recap: { tldr: '<img onerror=x> [#1]', sections: [] } });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img onerror'));
  assert.match(html, /<a class="cite" href="#e1">#1<\/a>/);
});

test('digest numbers steps and fits the budget', () => {
  const t = loadSession(ex('claude.jsonl'));
  const d = digest(t);
  assert.match(d, /\[#1\] USER: The tests/);
  assert.match(d, /TOOL Bash: npm test\n\s+✗ ERROR/);
  assert.ok(digest(t, { maxChars: 300 }).length < 1000);
});

test('locates sessions per agent and project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-home-'));
  const cwd = '/home/dev/api';
  const claudeDir = path.join(home, '.claude/projects/-home-dev-api');
  const codexDir = path.join(home, '.codex/sessions/2026/10/16');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
  fs.copyFileSync(ex('claude.jsonl'), path.join(claudeDir, 's1.jsonl'));
  fs.copyFileSync(ex('codex.jsonl'), path.join(codexDir, 'rollout-1.jsonl'));
  assert.equal(listSessions({ home, cwd }).length, 2);
  assert.equal(listSessions({ home, cwd, agent: 'codex' })[0].agent, 'codex');
  assert.equal(listSessions({ home, cwd: '/elsewhere', agent: 'codex' }).length, 0);
});

test('CLI renders every example and embeds a saved recap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-out-'));
  const env = { ...process.env, AGENT_REPLAY_HOME: dir };
  for (const f of ['claude.jsonl', 'codex.jsonl', 'gemini.json', 'aider.md']) {
    const out = path.join(dir, f + '.html');
    execFileSync('node', [bin, ex(f), '-o', out], { env });
    assert.match(fs.readFileSync(out, 'utf8'), /<main id="tl">/);
  }
  const recapFile = execFileSync('node', [bin, 'digest', ex('claude.jsonl')], { env }).toString().match(/recap file: (.+)/)[1];
  fs.mkdirSync(path.dirname(recapFile), { recursive: true });
  fs.copyFileSync(ex('claude.recap.json'), recapFile);
  const out = path.join(dir, 'with-recap.html');
  execFileSync('node', [bin, 'render', ex('claude.jsonl'), '-o', out], { env });
  const html = fs.readFileSync(out, 'utf8');
  assert.match(html, /class="recap"/);
  assert.match(html, /<title>Fixing the failing toggle test<\/title>/);
});
