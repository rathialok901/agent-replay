---
description: Render this session (or another agent's session) as a shareable HTML timeline
argument-hint: "[session-file] [--agent claude|codex|gemini|aider] [--all] [--no-thinking]"
allowed-tools: Bash(node:*)
---

Render an HTML replay with the agent-replay CLI. With no arguments it replays the newest Claude Code session for this project, which is the current one.

Run exactly:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" render --open $ARGUMENTS
```

Then reply with one line that gives the output path. If a recap was saved for this session earlier with /recap, it is already embedded at the top of the page; otherwise mention that `/recap` adds a summary and key findings.

If the command reports that no sessions were found, run `node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" list --all -n 10` and ask the user which session to replay.
