import { spawn } from 'node:child_process';
import { AGENT_NAMES, digest, listSessions, loadSession, readConfig, readRecap, recapPath, writeConfig, writeReplay } from './index.js';
import { redactDeep } from './redact.js';

const HELP = `agent-replay — replay, digest and recap AI coding agent sessions

Usage:
  agent-replay [render] [session-file] [options]   Write a shareable HTML timeline
  agent-replay digest   [session-file] [options]   Print a compact text digest (for recaps)
  agent-replay list     [options]                  List sessions, newest first
  agent-replay latest   [options]                  Print the newest session's path
  agent-replay config   [autoReplay on|off]        Show or change plugin settings

With no session file, the newest session for the current directory is used.

Options:
      --agent <name>   ${AGENT_NAMES.join(' | ')} (default: auto-detect; claude when searching)
      --cwd <dir>      Project directory to search (default: current directory)
      --all            Search every project, not just the current directory
  -o, --out <file>     Output HTML path (default: ~/.agent-replay/replays/…)
  -t, --title <text>   Page title
      --recap <file>   Embed a recap JSON (saved recaps are embedded automatically)
      --open           Open the HTML when done
      --no-redact      Keep secrets/emails/home paths (redaction is on by default)
      --no-thinking    Drop thinking blocks
      --thinking       Include thinking in the digest
      --max-chars <n>  Digest size budget (default 60000)
  -n <count>           Limit for list (default 20)
  -h, --help           Show this help`;

const COMMANDS = new Set(['render', 'digest', 'list', 'latest', 'config']);
const VALUE_FLAGS = { '-o': 'out', '--out': 'out', '-t': 'title', '--title': 'title', '--agent': 'agent', '--cwd': 'cwd', '--recap': 'recap', '--max-chars': 'maxChars', '-n': 'limit' };
const BOOL_FLAGS = {
  '--all': ['all', true], '--open': ['open', true], '--no-redact': ['redact', false],
  '--no-thinking': ['thinking', false], '--thinking': ['thinking', true], '-h': ['help', true], '--help': ['help', true],
};

function parseArgs(argv) {
  const opts = { positional: [], redact: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS[a]) {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      opts[VALUE_FLAGS[a]] = argv[++i];
    } else if (BOOL_FLAGS[a]) {
      const [k, v] = BOOL_FLAGS[a];
      opts[k] = v;
    } else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function resolveSession(opts) {
  if (opts.positional[0]) return loadSession(opts.positional[0], { agent: opts.agent });
  const agent = opts.agent ?? 'claude';
  const cwd = opts.all ? null : opts.cwd ?? process.cwd();
  const [latest] = listSessions({ agent, cwd, limit: 1 });
  if (!latest) throw new Error(`No ${agent} sessions found${cwd ? ` for ${cwd}` : ''}. Pass a file, --agent, or --all.`);
  return loadSession(latest.path, { agent });
}

function openFile(file) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [file]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]] : ['xdg-open', [file]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export function run(argv) {
  try {
    let cmd = argv[0];
    if (COMMANDS.has(cmd)) argv = argv.slice(1);
    else cmd = 'render';
    const opts = parseArgs(argv);
    if (opts.help) {
      console.log(HELP);
      return 0;
    }

    switch (cmd) {
      case 'render': {
        const t = resolveSession(opts);
        const out = writeReplay(t, {
          out: opts.out,
          title: opts.title,
          recap: opts.recap ? readRecap(opts.recap) : undefined,
          redact: opts.redact,
          thinking: opts.thinking !== false,
        });
        const tools = t.events.filter((e) => e.kind === 'tool').length;
        console.log(`Wrote ${out} (${t.meta.agent}, ${t.events.length} events, ${tools} tool calls${opts.redact ? ', redacted' : ''})`);
        if (opts.open) openFile(out);
        return 0;
      }
      case 'digest': {
        const t = resolveSession(opts);
        const view = opts.redact ? redactDeep(t) : t;
        console.log(digest(view, { maxChars: Number(opts.maxChars ?? 60000), thinking: opts.thinking === true }));
        console.log(`\n---\nsession file: ${t.meta.source}\nrecap file: ${recapPath(t)}`);
        return 0;
      }
      case 'list': {
        const cwd = opts.all ? null : opts.cwd ?? process.cwd();
        const sessions = listSessions({ agent: opts.agent, cwd, limit: Number(opts.limit ?? 20) });
        if (!sessions.length) console.log(`No sessions found${cwd ? ` for ${cwd} (try --all)` : ''}.`);
        for (const s of sessions) console.log(`${ago(s.mtime).padStart(8)}  ${s.agent.padEnd(6)}  ${(Math.round(s.size / 1024) + 'k').padStart(6)}  ${s.path}`);
        return 0;
      }
      case 'latest': {
        const t = resolveSession({ ...opts, positional: [] });
        console.log(t.meta.source);
        return 0;
      }
      case 'config': {
        const [key, value] = opts.positional;
        if (!key) console.log(JSON.stringify(readConfig(), null, 2));
        else if (key === 'autoReplay' && ['on', 'off'].includes(value)) console.log(JSON.stringify(writeConfig({ autoReplay: value === 'on' }), null, 2));
        else throw new Error('Usage: agent-replay config [autoReplay on|off]');
        return 0;
      }
    }
  } catch (err) {
    console.error(`agent-replay: ${err.message}`);
    return 1;
  }
}
