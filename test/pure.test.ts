import { describe, expect, it } from "vitest";
import contract from "./fixtures/contract.json";
import { changelogEntry, type ChangelogInput } from "../src/changelog";
import { MAX_ITEMS, itemsFromPrTitles, weekItems } from "../src/classify";
import { NEW_FILE_HEADER, hasEntry, spliceEntry } from "../src/splice";
import { lastCompletedWeek, parseWeekInput, weekContaining } from "../src/week";

describe("contract with Ship & Shout", () => {
  it.each(contract.map((c, i) => [i, c] as const))("case %i matches the product's output exactly", (_i, c) => {
    expect(changelogEntry(c.input as ChangelogInput)).toBe(c.expected);
  });
});

describe("weeks", () => {
  it("is the last completed Sat→Fri week, never the one in progress", () => {
    expect(lastCompletedWeek(new Date("2026-09-28T09:00:00Z"))).toEqual({
      start: "2026-09-19",
      end: "2026-09-25",
      since: "2026-09-19T00:00:00.000Z",
      until: "2026-09-26T00:00:00.000Z",
      label: "Sep 19–25",
    });
    expect(lastCompletedWeek(new Date("2026-09-25T23:00:00Z")).start).toBe("2026-09-12");
    expect(lastCompletedWeek(new Date("2026-09-26T00:00:00Z")).start).toBe("2026-09-19");
  });

  it("parses the week input and rejects junk", () => {
    expect(parseWeekInput("2026-10-01")?.label).toBe("Sep 26 – Oct 2");
    expect(parseWeekInput("2026-02-30")).toBeNull();
    expect(parseWeekInput("last week")).toBeNull();
    expect(weekContaining(new Date("2026-12-31T10:00:00Z")).label).toBe("Dec 26 – Jan 1");
  });
});

describe("classify", () => {
  it("keeps user-facing conventional commits and drops the rest", () => {
    expect(weekItems(["feat(ui): palette\n\nbody", "fix: crash on save", "chore: deps", "docs: readme", "Merge pull request #3 from x/y"], [])).toEqual([
      { type: "feat", title: "palette" },
      { type: "fix", title: "crash on save" },
    ]);
  });

  it("falls back to merged PR titles when commits aren't conventional, skipping housekeeping", () => {
    expect(weekItems(["wip", "more wip"], ["Add CSV export", "Bump lodash from 1 to 2", "fix(api): empty payloads", "chore: tidy", "Merge branch main"])).toEqual([
      { type: "feat", title: "Add CSV export" },
      { type: "fix", title: "empty payloads" },
    ]);
  });

  it("dedupes and caps", () => {
    const many = Array.from({ length: 30 }, (_, i) => `feat: thing ${i}`);
    expect(weekItems([...many, "feat: thing 0"], [])).toHaveLength(MAX_ITEMS);
    expect(weekItems(["feat: A", "feat: a", "fix: b"], [])).toHaveLength(2);
    expect(itemsFromPrTitles(["  "])).toEqual([]);
  });
});

const ENTRY = "## Week of Sep 26 – Oct 2, 2026\n\n### Added\n- New thing\n";

describe("spliceEntry", () => {
  it("creates a file with a neutral header", () => {
    expect(spliceEntry(null, ENTRY)).toBe(`${NEW_FILE_HEADER}\n${ENTRY}`);
  });

  it("puts the newest entry above older ones, under the title and intro", () => {
    const file = "# Changelog\n\nIntro line.\n\n## Week of Sep 19–25, 2026\n\n### Fixed\n- Old\n";
    expect(spliceEntry(file, ENTRY)).toBe(`# Changelog\n\nIntro line.\n\n${ENTRY}\n## Week of Sep 19–25, 2026\n\n### Fixed\n- Old\n`);
  });

  it("works with other entry styles and no title", () => {
    expect(spliceEntry("## [1.0.0] - 2026-01-01\n- x\n", ENTRY)).toBe(`${ENTRY}\n## [1.0.0] - 2026-01-01\n- x\n`);
  });

  it("keeps CRLF files CRLF", () => {
    const out = spliceEntry("# Changelog\r\n\r\n## Old\r\n- x\r\n", ENTRY);
    expect(out).toContain("\r\n## Week of Sep 26");
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("detects an entry that is already there", () => {
    expect(hasEntry(spliceEntry(null, ENTRY), ENTRY)).toBe(true);
    expect(hasEntry("# Changelog\r\n\r\n## Week of Sep 26 – Oct 2, 2026\r\n", ENTRY)).toBe(true);
    expect(hasEntry("# Changelog\n", ENTRY)).toBe(false);
  });
});
