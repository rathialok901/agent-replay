// One-line description of a tool call's input, shared by the HTML page and the digest.

const firstLine = (s, max = 140) => {
  const line = s.split('\n')[0];
  return line.length > max ? line.slice(0, max) + '…' : line;
};

export function toolSummary(input) {
  if (input == null) return '';
  if (typeof input === 'string') return firstLine(input);
  let pick =
    input.command ?? input.cmd ?? input.file_path ?? input.absolute_path ?? input.path ?? input.pattern ??
    input.url ?? input.query ?? input.description ?? input.prompt ?? input.summary ?? input.input;
  // Codex shell calls look like ["bash", "-lc", "npm test"]; show the script.
  if (Array.isArray(pick)) {
    pick = pick.length >= 3 && /^(ba|z)?sh$/.test(pick[0]) && String(pick[1]).startsWith('-') ? pick.at(-1) : pick.join(' ');
  }
  return firstLine(pick != null ? String(pick) : JSON.stringify(input));
}
