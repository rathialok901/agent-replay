// Finds session files each agent writes on this machine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ls = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

function walk(dir, match, depth = 4, out = []) {
  for (const d of ls(dir)) {
    const p = path.join(dir, d.name);
    if (d.isDirectory() && depth > 0) walk(p, match, depth - 1, out);
    else if (d.isFile() && match(d.name)) out.push(p);
  }
  return out;
}

function codexSessionCwd(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16384);
    const head = buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, 0)).toString('utf8');
    for (const line of head.split('\n')) {
      try {
        const e = JSON.parse(line);
        if (e.type === 'session_meta') return e.payload?.cwd ?? null;
      } catch {}
    }
  } catch {
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return null;
}

const FINDERS = {
  claude(roots, cwd) {
    const base = path.join(roots.claude, 'projects');
    const dirs = cwd
      ? [path.join(base, cwd.replace(/[^A-Za-z0-9]/g, '-'))]
      : ls(base).filter((d) => d.isDirectory()).map((d) => path.join(base, d.name));
    return dirs.flatMap((d) => ls(d).filter((f) => f.isFile() && f.name.endsWith('.jsonl')).map((f) => path.join(d, f.name)));
  },
  codex(roots, cwd) {
    const files = walk(path.join(roots.codex, 'sessions'), (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'));
    return cwd ? files.filter((f) => codexSessionCwd(f) === cwd) : files;
  },
  gemini(roots, cwd) {
    const base = path.join(roots.gemini, 'tmp');
    const dirs = cwd
      ? [path.join(base, crypto.createHash('sha256').update(cwd).digest('hex'))]
      : ls(base).filter((d) => d.isDirectory()).map((d) => path.join(base, d.name));
    return dirs.flatMap((d) =>
      ls(path.join(d, 'chats'))
        .filter((f) => f.isFile() && f.name.startsWith('session-') && f.name.endsWith('.json'))
        .map((f) => path.join(d, 'chats', f.name)),
    );
  },
  aider(roots, cwd) {
    // Aider keeps history inside each repo, so it can only be found relative to a directory.
    const f = path.join(cwd ?? process.cwd(), '.aider.chat.history.md');
    return fs.existsSync(f) ? [f] : [];
  },
};

export function listSessions({ agent, cwd, home, limit } = {}) {
  const h = home ?? os.homedir();
  // Respect the agents' own config-dir overrides unless a test passes an explicit home.
  const roots = {
    claude: (!home && process.env.CLAUDE_CONFIG_DIR) || path.join(h, '.claude'),
    codex: (!home && process.env.CODEX_HOME) || path.join(h, '.codex'),
    gemini: path.join(h, '.gemini'),
  };
  const agents = agent ? [agent] : Object.keys(FINDERS);
  const sessions = agents
    .flatMap((a) => {
      if (!FINDERS[a]) throw new Error(`Unknown agent "${a}". Supported: ${Object.keys(FINDERS).join(', ')}`);
      return FINDERS[a](roots, cwd).map((p) => ({ agent: a, path: p }));
    })
    .map((s) => {
      try {
        const st = fs.statSync(s.path);
        return { ...s, mtime: st.mtimeMs, size: st.size };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  return limit ? sessions.slice(0, limit) : sessions;
}
