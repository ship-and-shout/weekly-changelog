# Weekly Changelog

Keep `CHANGELOG.md` current without thinking about it. Every Monday this Action reads last week's merged PRs, conventional commits and releases, then opens a PR that adds one entry:

```markdown
## Week of Sep 26 – Oct 2, 2026

Released: v1.4.0

### Added
- CSV export
- Team invites

### Fixed
- Empty payloads in the API

### Improved
- Faster dashboard queries
```

You review the PR, edit anything you like, and merge. Quiet weeks are skipped.

## Setup (one file)

`.github/workflows/changelog.yml`:

```yaml
name: Weekly changelog
on:
  schedule: [{ cron: "17 6 * * 1" }] # Mondays 06:17 UTC
  workflow_dispatch:
permissions:
  contents: write
  pull-requests: write
jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: ship-and-shout/weekly-changelog@v1
```

That's it: no account, no API key, no config. Run it once by hand from the Actions tab to see your first entry.

> If PRs can't be created, enable **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"**.

## How the entry is built

- **Week:** the last *completed* week, Saturday → Friday (UTC).
- **Added / Fixed / Improved:** conventional commits on your default branch (`feat:` / `fix:` / `perf:`). If fewer than two qualify, merged PR titles are used instead. Dependency bumps, reverts, release and merge commits are skipped. `chore`, `docs`, `test`, `ci`, `refactor` and similar are left out on purpose: a changelog is for your users.
- **Released:** stable releases published that week (drafts and pre-releases are skipped).
- Up to 10 items, deduplicated. Wording comes straight from your commits and PR titles: nothing is rewritten, nothing is invented.

Tip: write PR titles as outcomes ("Exports open in Excel"), not tasks ("update csv writer"), and squash-merge. Your changelog will read like release notes.

## Inputs

| Input | Default | |
|---|---|---|
| `mode` | `pr` | `pr` opens a PR. `commit` pushes straight to the base branch (fails on protected branches). `none` writes nothing, only outputs and the job summary. |
| `changelog-path` | `CHANGELOG.md` | Created with a short header if missing. New entries go above older ones, under your title and intro. Any existing format is left alone. |
| `base-branch` | default branch | Branch to read from and target. |
| `skip-empty` | `true` | `false` writes "No user-facing changes this week." instead of skipping. |
| `week` | last completed week | Any `YYYY-MM-DD` inside the week you want. Useful for backfills. |
| `token` | job token | See the note on CI below. |

**Outputs:** `entry`, `week-start`, `empty`, `pr-url`.

Running it again for the same week does nothing: it checks for the week's heading in the file and for an existing `changelog/week-<date>` branch.

### CI on the opened PR

PRs opened with the default `GITHUB_TOKEN` don't trigger other workflows (a GitHub rule). If you need CI to run on them, pass a fine-grained PAT with Contents + Pull requests write: `with: { token: ${{ secrets.CHANGELOG_TOKEN }} }`.

## Privacy

The Action only talks to the GitHub API, with your job token, for your repo. It sends **nothing** to us or anyone else: no telemetry, no analytics. The PR description ends with one link to Ship & Shout. Your `CHANGELOG.md` never gets anything except the entry.

## Want the week as a post too?

This Action is the free, open-source half of [Ship & Shout](https://www.shipandshout.com/?utm_source=changelog-action-readme). Ship & Shout turns the same week into a short, numbers-first post for X, LinkedIn and Bluesky, with an optional revenue chart. Try it on any public repo, no account needed: [shipandshout.com/try](https://www.shipandshout.com/try?utm_source=changelog-action-readme).

## License

MIT
