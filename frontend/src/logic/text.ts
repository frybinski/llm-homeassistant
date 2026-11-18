/** Small pure text helpers shared by the layouts. */

/** Greedy word wrap to at most `maxLines` lines of about `maxChars` characters. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1)}…`;
    return kept;
  }
  return lines;
}

/** "00:03:00" to a spoken duration, e.g. "3 Minuten"; unknown shapes pass through. */
export function formatDuration(
  value: string,
  units: { hour: [string, string]; minute: [string, string]; second: [string, string] },
): string {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const parts: string[] = [];
  const add = (n: number, [one, many]: [string, string]) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(Number(m[1]), units.hour);
  add(Number(m[2]), units.minute);
  add(Number(m[3]), units.second);
  return parts.join(" ") || value;
}
