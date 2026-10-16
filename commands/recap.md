---
description: Summarize a session and extract key findings (troubleshooting, feature, research), then embed them in the replay
argument-hint: "[troubleshooting|feature|research|general] [session-file] [--agent codex|gemini|aider]"
allowed-tools: Bash(node:*), Write
---

Produce a recap of an agent session and attach it to the HTML replay.

Arguments: `$ARGUMENTS`. If the first word is `troubleshooting`, `feature`, `research` or `general`, it is the recap type; pass the remaining arguments to the CLI. With no session file, the CLI uses the current session.

## 1. Read the digest

```
node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" digest <remaining arguments>
```

The digest numbers every step `[#n]` and ends with a `recap file:` path. Base the recap only on the digest, not on your memory of the conversation, so it matches the replay's step numbers.

## 2. Pick the type

If no type was given, choose the one that fits best:

| type | use when | sections, in order |
|---|---|---|
| troubleshooting | something was broken and the session investigated or fixed it | Symptom · Root cause · Fix · Commands that worked · Dead ends · Verification · Follow-ups |
| feature | the session built or changed functionality | What changed · Files touched · Decisions · Open TODOs |
| research | the session explored a question or compared options | Question · Findings · Sources · Open questions |
| general | anything else | Goal · What happened · Outcome · Follow-ups |

## 3. Write the recap JSON

Write it with the Write tool to the `recap file:` path from the digest:

```json
{
  "type": "troubleshooting",
  "title": "Short name of what this session was about",
  "tldr": "One or two plain sentences: the problem and how it ended.",
  "sections": [
    { "heading": "Root cause", "items": ["`toggle` wrote `done` instead of `completed` [#5]"] }
  ]
}
```

Rules:
- Cite the step each item comes from as `[#n]`; the replay turns these into links.
- Leave out sections with nothing real to say. Never pad or invent.
- "Commands that worked" holds exact commands in backticks, copied from the digest.
- "Dead ends" lists what was tried and ruled out, and why, so nobody repeats it.
- If the session never resolved, say so in the tldr and under Follow-ups.
- Keep secrets out; the digest is already redacted, so don't reintroduce anything.

## 4. Re-render and report

```
node "${CLAUDE_PLUGIN_ROOT}/bin/agent-replay.js" render --open <remaining arguments>
```

The saved recap is embedded automatically. Reply with the recap as short markdown (title, tldr, then the sections as bullets) followed by the HTML path.
