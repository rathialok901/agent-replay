// Best-effort scrubbing of common secrets before a replay is shared. Not a guarantee.

import os from 'node:os';

const PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/g, '[REDACTED_ANTHROPIC_KEY]'],
  [/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, '[REDACTED_GITHUB_TOKEN]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]'],
  [/xox[abpr]-[A-Za-z0-9-]{10,}/g, '[REDACTED_SLACK_TOKEN]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'],
  [/\b(Bearer)\s+[A-Za-z0-9._-]{16,}/g, '$1 [REDACTED]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
];

export function redactString(s) {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  const home = os.homedir();
  if (home && home.length > 1) out = out.split(home).join('~');
  return out;
}

export function redactDeep(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
}
