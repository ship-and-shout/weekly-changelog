import { weekLabel } from "./week";

// A Keep-a-Changelog style Markdown entry for one week. Same output as Ship &
// Shout's changelog export: both repos test against test/fixtures/contract.json.

export interface ChangelogInput {
  /** Week start (Saturday), YYYY-MM-DD. */
  weekStart: string;
  items: { title: string; type?: string }[];
  releases?: string[];
}

// Items are already feat/fix/perf; anything else, or no type (PR titles),
// reads as an addition.
const SECTIONS = ["Added", "Fixed", "Improved"] as const;
const SECTION_OF: Record<string, (typeof SECTIONS)[number]> = { fix: "Fixed", perf: "Improved" };

function line(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function changelogEntry({ weekStart, items, releases = [] }: ChangelogInput): string {
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const out = [`## Week of ${weekLabel(weekStart, end.toISOString().slice(0, 10))}, ${end.getUTCFullYear()}`, ""];
  if (releases.length) out.push(`Released: ${releases.join(", ")}`, "");

  const clean = items.map((i) => ({ title: line(i.title), section: SECTION_OF[i.type ?? ""] ?? "Added" })).filter((i) => i.title);
  for (const heading of SECTIONS) {
    const rows = clean.filter((i) => i.section === heading);
    if (rows.length) out.push(`### ${heading}`, ...rows.map((r) => `- ${r.title}`), "");
  }
  if (!clean.length) out.push("- No user-facing changes this week.", "");
  return out.join("\n");
}
