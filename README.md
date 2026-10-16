# agent-replay

Replay, summarize and extract key findings from AI coding agent sessions. Each session becomes one shareable HTML page with every prompt, reply, thinking block and tool call. A recap at the top states what the session found and links each point to the step it came from.

It ships as a CLI that works with several agents and as a Claude Code plugin.

## Why use it

An agent session is a long, linear log that nobody wants to scroll through. It holds a lot of useful information: the root cause of a bug, the command that finally worked, the three approaches that didn't. That information disappears when the terminal closes. `agent-replay` keeps it in a form people can read, search and share.

- **Write a postmortem from a debugging session.** `/recap troubleshooting` pulls out the symptom, root cause, fix, exact commands that worked and the dead ends, each linked to the step it came from. Paste it into a ticket or wiki.
- **Review what an agent did before you merge it.** Skim every tool call, file edit and failed command in one page. Filter by tool, or search for a file name.
- **Hand off work.** Send a teammate the replay instead of explaining what the agent tried. Or start tomorrow with a recap of today's open TODOs.
- **See where tokens and time went.** Per-step token counts, cache usage, durations and a tool histogram show which steps were expensive or kept failing.
- **Compare agents on the same task.** Replays of Claude Code, Codex, Gemini and Aider look the same, so differences in approach are easy to see.
- **Build a knowledge base.** Recaps are plain JSON files, so you can search or index them to find how you fixed something last time.
- **Teach and demo.** A replay is one self-contained file you can attach to a PR, issue or gist, with no tool and no account needed to read it.

| Agent | Session files | Auto-located |
|---|---|---|
| Claude Code | `~/.claude/projects/<project>/<session>.jsonl` | ✓ |
| Codex CLI | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | ✓ |
| Gemini CLI | `~/.gemini/tmp/<project-hash>/chats/session-*.json` | ✓ |
| Aider | `<repo>/.aider.chat.history.md` | ✓ (per repo) |

## Claude Code plugin

```
/plugin marketplace add rathialok901/agent-replay
/plugin install agent-replay@agent-replay
```

Enable or disable it any time from `/plugin`.

- **`/replay`**: writes an HTML replay of the current session and opens it. Pass a file or `--agent codex|gemini|aider` to replay other agents' sessions.
- **`/recap [troubleshooting|feature|research|general]`**: Claude reads a compact digest of the session and writes a structured recap. Claude runs the recap itself, so it needs no extra API key. The recap is embedded at the top of the replay.
- **`/replay-auto on|off`**: writes a replay automatically every time a session ends. It's off by default.

Recap templates:

| type | sections |
|---|---|
| troubleshooting | Symptom · Root cause · Fix · Commands that worked · Dead ends · Verification · Follow-ups |
| feature | What changed · Files touched · Decisions · Open TODOs |
| research | Question · Findings · Sources · Open questions |
| general | Goal · What happened · Outcome · Follow-ups |

## CLI

```sh
npx agent-replay                          # newest Claude Code session in this directory
npx agent-replay --agent codex --open     # newest Codex session here, then open it
npx agent-replay path/to/session.jsonl    # any file; the agent is auto-detected
npx agent-replay list --all               # recent sessions from every agent
npx agent-replay digest                   # compact, step-numbered text view for LLM summaries
```

Replays go to `~/.agent-replay/replays/` unless you pass `-o`. A recap saved at the path that `digest` prints is embedded automatically, and you can also pass one with `--recap file.json`. Run `agent-replay --help` for every option.

## Privacy

- **Redaction is on by default** for both replays and digests. It removes API keys, tokens, private keys and emails, and replaces your home directory with `~`. It works by pattern matching, so review a page before sharing it publicly.
- **Everything is a local file.** Pages make no network requests, and nothing is uploaded.

## Adding an agent

Write `src/adapters/<agent>.js` exporting `name`, `label`, `detect(text, file)` and `parse(text)`. Build the timeline with `createTimeline()` from `src/timeline.js`. Register the adapter in `src/adapters/index.js`, and add a finder in `src/locate.js` if its sessions live in a known place. Add a synthetic example to `examples/` with a test.

## Development

```sh
npm test
node bin/agent-replay.js examples/codex.jsonl -o /tmp/codex.html --open
claude --plugin-dir .          # try the plugin locally
```

MIT licensed.
