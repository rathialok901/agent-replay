---
description: Turn automatic replays at session end on or off
argument-hint: "on|off|status"
allowed-tools: Bash(node:*)
---

Automatic replays write an HTML replay of every Claude Code session when it ends, into `~/.agent-replay/replays/`. They are off by default.

- `on` or `off`: run `node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" config autoReplay $ARGUMENTS`
- `status` or no argument: run `node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" config`

Reply with one line saying whether automatic replays are now on or off.
