# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The landing page for app.choonsiong.com, served as-is from GitHub Pages
(legacy branch mode, `main`, root). No build step, no package manager, no
tests, no linter. `CNAME` sets the domain; `.nojekyll` keeps Pages from
running Jekyll.

## Commands

```bash
# Run locally. ES modules don't load from file://, so serve over HTTP.
python3 -m http.server 8000      # then open http://localhost:8000

# Regenerate the contribution calendar locally (needs gh, authenticated, and jq).
# Output is git-ignored; the workflow is what publishes it.
.github/scripts/contributions.sh choonsiong

# Run the calendar workflow on demand instead of waiting for the daily schedule.
gh workflow run contributions.yml --ref main
```

Verification is visual: open the page over HTTP and check the section you
changed, at desktop width and a phone width.

## Architecture

Three source files, each with one job:

- `index.html` is all the content. Sections are numbered in their `.kicker`
  (01 Apps, 02 Activity, 03 About); insert a section and renumber the ones
  after it. App cards are plain `<article class="card">` blocks in `#apps`.
  three.js is loaded from jsDelivr through the import map in `<head>`; bump
  the version there and in the About `.stack` list together.
- `style.css` holds the theme as CSS custom properties in `:root` (`--accent`
  teal, `--accent-2` violet, `--bg`, `--line`, …). New UI should use those
  tokens, not new colours. `.reveal` elements are hidden until `main.js` adds
  `.in` on scroll, so anything you add with `.reveal` only appears if it is
  observed; content inserted later inside an already-observed `.reveal`
  element is fine.
- `main.js` is one ES module with two halves. The top half is page behaviour
  that must work without WebGL: nav shading, reveal-on-scroll, the card
  cursor glow (`--mx`/`--my`), and the contribution heatmap. The bottom half
  builds the three.js scene (wireframe icosahedron, glassy core, two rings, a
  shader particle field) on the fixed `#scene` canvas; the camera follows the
  cursor and pulls back with scroll. If `WebGLRenderer` throws, `body` gets
  `.no-webgl` and the canvas is hidden; under `prefers-reduced-motion` it
  renders a single frame; the loop pauses when the tab is hidden. Keep new
  non-3D behaviour in the top half so it runs on the fallback path.

### The contribution calendar

The Activity section is the only part with data outside this branch.
GitHub's contribution calendar is reachable only through its GraphQL API,
which needs a token, so the browser can't fetch it. Instead:

1. `.github/workflows/contributions.yml` runs daily (02:17 UTC) and on
   `workflow_dispatch`, calling `.github/scripts/contributions.sh`, which uses
   `gh api graphql` and `jq` to write `contributions.json`
   (`{login, total, days: [[date, count, level 0-4], …]}`, oldest first).
2. The workflow commits that file to the orphan `data` branch, which holds
   nothing else, and only when it changed. **Do not delete the `data`
   branch** and do not make the workflow push to `main`: the `protected-main`
   ruleset rejects direct pushes, which is why the branch exists.
3. `main.js` fetches the file from
   `raw.githubusercontent.com/choonsiong/choonsiong.github.io/data/…`
   (CORS-enabled, cached five minutes) and builds the grid: weeks are
   Sunday-first columns, the first week padded with `.cell.pad`; a month
   label goes on the column where the month starts, the later month winning
   a shared column. On any failure the section hides the total and legend
   and shows a link to GitHub.

The workflow's token is enough for a public profile. If GitHub refuses it,
add a repository secret `CONTRIBUTIONS_TOKEN` (fine-grained PAT, no
permissions); the workflow prefers it when present.

## Workflow and releases

Changes reach `main` only through pull requests (ruleset, no bypass). Pushing
to `main` deploys. After each merge `main` is tagged `vX.Y.Z` (minor for a
`feat/` branch, patch otherwise) and `.github/workflows/release.yml` turns the
tag into a GitHub release with generated notes; it refuses tags not on
`main`. A release is a record, not a deploy. `claude.yml` and
`claude-code-review.yml` run Claude on `@claude` mentions and on pull
requests.

`claude-export/` holds exported chat transcripts and is git-ignored; nothing
in it is used by the site.
