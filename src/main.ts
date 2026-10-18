import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { run, type Mode } from "./run";
import { lastCompletedWeek, parseWeekInput } from "./week";

async function main(): Promise<void> {
  const mode = (core.getInput("mode") || "pr") as Mode;
  if (!["pr", "commit", "none"].includes(mode)) throw new Error(`mode must be pr, commit or none (got "${mode}")`);
  const weekInput = core.getInput("week");
  const week = weekInput ? parseWeekInput(weekInput) : lastCompletedWeek(new Date());
  if (!week) throw new Error(`week must be a date like 2026-10-05 (got "${weekInput}")`);

  const octokit = getOctokit(core.getInput("token", { required: true }));
  const repo = context.repo;
  const { data: meta } = await octokit.rest.repos.get(repo);
  const base = core.getInput("base-branch") || meta.default_branch;

  const out = await run(octokit, {
    repo,
    isPrivate: meta.private,
    base,
    week,
    mode,
    path: core.getInput("changelog-path") || "CHANGELOG.md",
    skipEmpty: core.getBooleanInput("skip-empty"),
  });

  core.info(out.note);
  core.setOutput("entry", out.entry);
  core.setOutput("week-start", week.start);
  core.setOutput("empty", String(out.empty));
  core.setOutput("pr-url", out.write?.kind === "pr" ? out.write.url : "");
  await core.summary.addHeading(`Weekly changelog · ${week.label}`, 3).addRaw(`${out.note}\n\n`).addCodeBlock(out.entry, "markdown").write();
}

main().catch((err) => core.setFailed(err instanceof Error ? err.message : String(err)));
