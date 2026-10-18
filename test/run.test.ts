import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "../src/github";
import { footer, run, type RunInput } from "../src/run";
import { weekContaining } from "../src/week";

const WEEK = weekContaining(new Date("2026-09-30T12:00:00Z")); // Sep 26 – Oct 2
const REPO = { owner: "acme", repo: "widget" };
const notFound = () => Object.assign(new Error("Not Found"), { status: 404 });

function fake(o: { commits?: string[]; prs?: { title: string; merged_at: string | null; updated_at: string }[]; file?: string | null; branch?: boolean } = {}) {
  const calls = {
    createRef: vi.fn(async () => ({ data: {} })),
    write: vi.fn(async (_args: { content: string; branch: string; sha?: string }) => ({ data: { commit: { html_url: "https://github.com/acme/widget/commit/1" } } })),
    createPr: vi.fn(async (_args: { body: string; title: string }) => ({ data: { html_url: "https://github.com/acme/widget/pull/7" } })),
  };
  const octokit = {
    rest: {
      repos: {
        listCommits: async () => ({ data: (o.commits ?? ["feat: palette", "fix: crash"]).map((message) => ({ commit: { message } })) }),
        listReleases: async () => ({ data: [{ draft: false, prerelease: false, published_at: "2026-09-29T10:00:00Z", tag_name: "v1.2.0" }, { draft: false, prerelease: true, published_at: "2026-09-29T11:00:00Z", tag_name: "v1.3.0-canary.1" }] }),
        getContent: async () => {
          if (o.file === null || o.file === undefined) throw notFound();
          return { data: { type: "file", content: Buffer.from(o.file).toString("base64"), sha: "blob1" } };
        },
        createOrUpdateFileContents: calls.write,
      },
      pulls: {
        list: async () => ({ data: o.prs ?? [] }),
        create: calls.createPr,
      },
      git: {
        getRef: async ({ ref }: { ref: string }) => {
          if (ref.startsWith("heads/changelog/") && !o.branch) throw notFound();
          return { data: { object: { sha: "base-sha" } } };
        },
        createRef: calls.createRef,
      },
    },
  } as unknown as Octokit;
  return { octokit, calls };
}

const input = (over: Partial<RunInput> = {}): RunInput => ({ repo: REPO, isPrivate: false, base: "main", week: WEEK, mode: "pr", path: "CHANGELOG.md", skipEmpty: true, ...over });

describe("run", () => {
  it("opens a PR with the entry; the footer goes in the PR body only", async () => {
    const { octokit, calls } = fake({ file: "# Changelog\n" });
    const out = await run(octokit, input());
    expect(out.write).toEqual({ kind: "pr", url: "https://github.com/acme/widget/pull/7" });
    expect(calls.createRef).toHaveBeenCalledWith(expect.objectContaining({ ref: "refs/heads/changelog/week-2026-09-26", sha: "base-sha" }));
    const written = Buffer.from(calls.write.mock.calls[0][0].content, "base64").toString("utf8");
    expect(written).toBe("# Changelog\n\n## Week of Sep 26 – Oct 2, 2026\n\nReleased: v1.2.0\n\n### Added\n- Palette\n\n### Fixed\n- Crash\n");
    expect(written).not.toContain("shipandshout");
    expect(calls.write.mock.calls[0][0]).toMatchObject({ branch: "changelog/week-2026-09-26", sha: "blob1" });
    const body = calls.createPr.mock.calls[0][0].body;
    expect(body).toContain("https://www.shipandshout.com/try/acme/widget?utm_source=changelog-action");
    expect(calls.createPr.mock.calls[0][0].title).toBe("docs(changelog): week of Sep 26 – Oct 2");
  });

  it("is a no-op when the PR branch exists or the file already has the week", async () => {
    const a = fake({ branch: true });
    expect((await run(a.octokit, input())).write).toBeNull();
    const b = fake({ file: "# Changelog\n\n## Week of Sep 26 – Oct 2, 2026\n- x\n" });
    expect((await run(b.octokit, input())).write).toBeNull();
    expect(a.calls.write).not.toHaveBeenCalled();
    expect(b.calls.write).not.toHaveBeenCalled();
  });

  it("skips a quiet week by default and writes nothing in mode none", async () => {
    const quiet = fake({ commits: ["chore: deps"] });
    (quiet.octokit.rest.repos as unknown as { listReleases: unknown }).listReleases = async () => ({ data: [] });
    const out = await run(quiet.octokit, input());
    expect(out).toMatchObject({ empty: true, write: null });
    expect(out.entry).toContain("No user-facing changes this week.");

    const none = fake();
    expect((await run(none.octokit, input({ mode: "none" }))).write).toBeNull();
    expect(none.calls.write).not.toHaveBeenCalled();
  });

  it("commits straight to the base in commit mode, creating the file if missing", async () => {
    const { octokit, calls } = fake({ file: null });
    const out = await run(octokit, input({ mode: "commit" }));
    expect(out.write?.kind).toBe("commit");
    expect(calls.write.mock.calls[0][0]).toMatchObject({ branch: "main" });
    expect(calls.write.mock.calls[0][0].sha).toBeUndefined();
    expect(calls.createPr).not.toHaveBeenCalled();
  });

  it("explains a protected-branch refusal", async () => {
    const { octokit } = fake({ file: null });
    (octokit.rest.repos as unknown as { createOrUpdateFileContents: unknown }).createOrUpdateFileContents = async () => {
      throw Object.assign(new Error("protected"), { status: 409 });
    };
    await expect(run(octokit, input({ mode: "commit" }))).rejects.toThrow(/mode: pr/);
  });

  it("counts only PRs merged inside the week", async () => {
    const { octokit } = fake({
      commits: ["wip"],
      prs: [
        { title: "Add CSV export", merged_at: "2026-09-28T10:00:00Z", updated_at: "2026-09-28T10:00:00Z" },
        { title: "Old feature", merged_at: "2026-09-10T10:00:00Z", updated_at: "2026-09-28T11:00:00Z" },
        { title: "Closed unmerged", merged_at: null, updated_at: "2026-09-28T12:00:00Z" },
      ],
      file: null,
    });
    const out = await run(octokit, input({ mode: "none" }));
    expect(out.entry).toContain("- Add CSV export");
    expect(out.entry).not.toContain("Old feature");
    expect(out.entry).not.toContain("Closed unmerged");
  });
});

describe("footer", () => {
  it("links private repos to the home page, since /try only reads public repos", () => {
    expect(footer(REPO, true)).toContain("https://www.shipandshout.com/?utm_source=changelog-action");
    expect(footer(REPO, true)).not.toContain("/try/");
  });
});
