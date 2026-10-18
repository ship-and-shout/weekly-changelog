import type { getOctokit } from "@actions/github";
import type { Week } from "./week";

export type Octokit = ReturnType<typeof getOctokit>;

export interface Repo {
  owner: string;
  repo: string;
}

export interface WeekData {
  commitMessages: string[];
  prTitles: string[];
  releases: string[];
  /** A list hit MAX_PAGES and more existed — the entry may be missing items. */
  capped: boolean;
}

/** Pages of 100 per list endpoint — bounds cost on very busy repos. */
export const MAX_PAGES = 10;

const inRange = (iso: string | null | undefined, w: Week) => !!iso && iso >= w.since && iso < w.until;

// Read-only: everything the entry needs, from the repo the Action runs in.
export async function readWeek(octokit: Octokit, r: Repo, base: string, w: Week): Promise<WeekData> {
  let capped = false;

  const commitMessages: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.repos.listCommits({ ...r, sha: base, since: w.since, until: w.until, per_page: 100, page });
    commitMessages.push(...data.map((c) => c.commit.message));
    if (data.length < 100) break;
    if (page === MAX_PAGES) capped = true;
  }

  // GitHub can't filter PRs by merge date: walk recently-updated closed PRs
  // into this base and stop once a page is entirely older than the window.
  const prTitles: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.pulls.list({ ...r, state: "closed", base, sort: "updated", direction: "desc", per_page: 100, page });
    for (const p of data) if (inRange(p.merged_at, w)) prTitles.push(p.title);
    if (data.length < 100 || data.every((p) => p.updated_at < w.since)) break;
    if (page === MAX_PAGES) capped = true;
  }

  const { data: rel } = await octokit.rest.repos.listReleases({ ...r, per_page: 50 });
  // Stable releases only: canaries and betas would drown the entry.
  const releases = rel.filter((x) => !x.draft && !x.prerelease && inRange(x.published_at, w)).map((x) => x.tag_name);

  return { commitMessages, prTitles, releases, capped };
}

function status(err: unknown): number | undefined {
  return typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : undefined;
}

/** The file on `ref` (text + blob sha), or null when it doesn't exist. */
export async function readFile(octokit: Octokit, r: Repo, path: string, ref: string): Promise<{ text: string; sha: string } | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ ...r, path, ref });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) throw new Error(`${path} is not a file`);
    return { text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
  } catch (err) {
    if (status(err) === 404) return null;
    throw err;
  }
}

export async function branchExists(octokit: Octokit, r: Repo, branch: string): Promise<boolean> {
  try {
    await octokit.rest.git.getRef({ ...r, ref: `heads/${branch}` });
    return true;
  } catch (err) {
    if (status(err) === 404) return false;
    throw err;
  }
}

export interface WriteResult {
  kind: "pr" | "commit";
  url: string;
}

/** New branch from `base`, commit the file there, open a PR. */
export async function openPr(
  octokit: Octokit,
  r: Repo,
  o: { base: string; branch: string; path: string; content: string; fileSha?: string; message: string; title: string; body: string },
): Promise<WriteResult> {
  const { data: ref } = await octokit.rest.git.getRef({ ...r, ref: `heads/${o.base}` });
  await octokit.rest.git.createRef({ ...r, ref: `refs/heads/${o.branch}`, sha: ref.object.sha });
  await octokit.rest.repos.createOrUpdateFileContents({
    ...r,
    path: o.path,
    branch: o.branch,
    message: o.message,
    content: Buffer.from(o.content, "utf8").toString("base64"),
    ...(o.fileSha ? { sha: o.fileSha } : {}),
  });
  const { data: pr } = await octokit.rest.pulls.create({ ...r, base: o.base, head: o.branch, title: o.title, body: o.body });
  return { kind: "pr", url: pr.html_url };
}

/** Commit straight to `base`. Protected branches refuse — say how to fix it. */
export async function commitDirect(
  octokit: Octokit,
  r: Repo,
  o: { base: string; path: string; content: string; fileSha?: string; message: string },
): Promise<WriteResult> {
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      ...r,
      path: o.path,
      branch: o.base,
      message: o.message,
      content: Buffer.from(o.content, "utf8").toString("base64"),
      ...(o.fileSha ? { sha: o.fileSha } : {}),
    });
    return { kind: "commit", url: data.commit.html_url ?? "" };
  } catch (err) {
    const s = status(err);
    if (s === 403 || s === 409 || s === 422) {
      throw new Error(`Couldn't commit to ${o.base} (HTTP ${s}). The branch is probably protected. Use "mode: pr" instead, or give the job "permissions: contents: write".`);
    }
    throw err;
  }
}
