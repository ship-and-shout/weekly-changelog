// Put a week's entry into an existing CHANGELOG without disturbing it: newest
// first, under the file's title/intro, above the first "## " entry. Keeps the
// file's line endings. Never adds anything but the entry itself.

export const NEW_FILE_HEADER = "# Changelog\n\nAll notable changes to this project, week by week.\n";

/** The entry's first line, e.g. "## Week of Sep 26 – Oct 2, 2026". */
export function entryHeading(entry: string): string {
  return entry.split("\n")[0].trim();
}

export function hasEntry(file: string, entry: string): boolean {
  const heading = entryHeading(entry);
  return file.split(/\r?\n/).some((l) => l.trim() === heading);
}

export function spliceEntry(file: string | null, entry: string): string {
  const source = file ?? NEW_FILE_HEADER;
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const block = entry.replace(/\n+$/, "").split("\n");

  const firstEntry = lines.findIndex((l) => l.startsWith("## "));
  let out: string[];
  if (firstEntry >= 0) {
    out = [...lines.slice(0, firstEntry), ...block, "", ...lines.slice(firstEntry)];
  } else {
    // No entries yet: after the whole header/intro.
    const head = [...lines];
    while (head.length && head[head.length - 1].trim() === "") head.pop();
    out = head.length ? [...head, "", ...block, ""] : [...block, ""];
  }
  return out.join(eol);
}
