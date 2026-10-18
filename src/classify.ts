// Turn a week's commits and merged PR titles into changelog items — the same
// rules Ship & Shout uses for its posts:
// - conventional commits: keep feat / fix / perf (user-facing), drop the rest;
// - fewer than 2 such items → merged PR titles stand in (conventional types
//   read, plain titles count as additions, housekeeping skipped);
// - dedupe by title, cap at MAX_ITEMS.

export interface Item {
  title: string;
  type: string;
}

export const MAX_ITEMS = 10;
const KEEP = new Set(["feat", "fix", "perf"]);
const CONVENTIONAL = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/;
const HOUSEKEEPING = /^(?:bump\b|update dependenc|upgrade dependenc|deps?\b|\[bot\]|revert\b|release\b|merge\b|v?\d+\.\d+\.\d+)/i;

function conventional(text: string): Item | null {
  const m = text.split("\n")[0].trim().match(CONVENTIONAL);
  return m ? { type: m[1].toLowerCase(), title: m[2].trim() } : null;
}

export function itemsFromCommits(messages: string[]): Item[] {
  return messages.map(conventional).filter((i): i is Item => !!i);
}

export function itemsFromPrTitles(titles: string[]): Item[] {
  const out: Item[] = [];
  for (const t of titles) {
    const title = t.trim().replace(/\s+/g, " ");
    if (!title) continue;
    const c = conventional(title);
    if (c) out.push({ type: c.type, title: c.title.slice(0, 120) });
    else if (!HOUSEKEEPING.test(title)) out.push({ type: "feat", title: title.slice(0, 120) });
  }
  return out;
}

function keep(items: Item[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const item of items) {
    if (!KEEP.has(item.type)) continue;
    const key = item.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

export function weekItems(commitMessages: string[], prTitles: string[]): Item[] {
  const fromCommits = keep(itemsFromCommits(commitMessages));
  return fromCommits.length >= 2 ? fromCommits : keep([...fromCommits, ...itemsFromPrTitles(prTitles)]);
}
