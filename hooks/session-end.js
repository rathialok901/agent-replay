#!/usr/bin/env node
// Claude Code SessionEnd hook: writes a replay of the finished session when autoReplay is on.
import fs from 'node:fs';
import { loadSession, readConfig, writeReplay } from '../src/index.js';

try {
  if (readConfig().autoReplay) {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    if (input.transcript_path && fs.existsSync(input.transcript_path)) {
      writeReplay(loadSession(input.transcript_path, { agent: 'claude' }));
    }
  }
} catch {
  // Never block or slow down session exit.
}
