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

# Regenerate the data files locally (needs gh, authenticated, and jq). Both
# are git-ignored; the workflow is what publishes them. Served from
# localhost, the page reads these local copies before the published ones.
.github/scripts/contributions.sh choonsiong
.github/scripts/languages.sh choonsiong

# Run the data workflow on demand instead of waiting for the daily schedule.
gh workflow run data.yml --ref main
```

Verification is visual: open the page over HTTP and check the section you
changed, at desktop width and a phone width.

## Architecture

Three source files, each with one job:

- `index.html` is all the content. Sections are numbered in their `.kicker`
  (01 Apps, 02 Activity, 03 Stack, 04 About); insert a section and renumber
  the ones after it. App cards are plain `<article class="card">` blocks in
  `#apps`. three.js is loaded from jsDelivr through the import map in
  `<head>`; bump the version there and in the About `.stack` list together.
- `style.css` holds the theme as CSS custom properties in `:root` (`--accent`
  teal, `--accent-2` violet, `--bg`, `--line`, …). New UI should use those
  tokens, not new colours. `--lang-1` to `--lang-8` and `--lang-other` are
  the Stack ring's categorical palette, assigned to languages largest-first
  in that fixed order (it was checked for colour-vision separation; reorder
  or recolour only with that check redone). `.reveal` elements are hidden
  until `main.js` adds `.in` on scroll, so anything you add with `.reveal`
  only appears if it is observed; content inserted later inside an
  already-observed `.reveal` element is fine.
- `main.js` is one ES module with two halves. The top half is page behaviour
  that must work without WebGL: nav shading, reveal-on-scroll, the card
  cursor glow (`--mx`/`--my`), the contribution heatmap, and the Stack
  section's language list (`loadLanguages`, with the `stack` object holding
  which language is hovered or pinned). The bottom half builds the three.js
  scene (wireframe icosahedron, glassy core, two rings, a shader particle
  field) on the fixed `#scene` canvas; the camera follows the cursor and
  pulls back with scroll. If `WebGLRenderer` throws, `body` gets `.no-webgl`
  and the canvas is hidden; under `prefers-reduced-motion` it renders a
  single frame; the loop pauses when the tab is hidden. Keep new non-3D
  behaviour in the top half so it runs on the fallback path.
  `mountStackRing` at the end draws the Stack ring on its own canvas
  (`#stack-canvas`) with a second renderer: one extruded arc per language,
  hover or a row lifts it, a click pins it, a drag spins it. It renders only
  while the section is on screen and follows the same `stack` state as the
  list. Without WebGL the list shows a thin segmented bar (`.stack-strip`)
  instead.

### The data branch

The Activity and Stack sections are the only parts with data outside this
branch. Both come from GitHub's GraphQL API, which needs a token, so the
browser can't fetch them. Instead:

1. `.github/workflows/data.yml` runs daily (02:17 UTC) and on
   `workflow_dispatch`, calling two scripts that use `gh api graphql` and
   `jq`: `.github/scripts/contributions.sh` writes `contributions.json`
   (`{login, total, days: [[date, count, level 0-4], …]}`, oldest first) and
   `.github/scripts/languages.sh` writes `languages.json` (`{login, repos,
   total, languages: [{name, color, bytes, repos}, …]}`, largest first,
   summed over every owned non-fork repository the token can see; totals
   only, never repository names).
2. The workflow commits those files to the orphan `data` branch, which holds
   nothing else, and only when they changed. **Do not delete the `data`
   branch** and do not make the workflow push to `main`: the `protected-main`
   ruleset rejects direct pushes, which is why the branch exists.
3. `main.js` fetches them from
   `raw.githubusercontent.com/choonsiong/choonsiong.github.io/data/…`
   (CORS-enabled, cached five minutes) through `fetchData`, which on
   localhost tries the git-ignored local copies first. The calendar grid:
   weeks are Sunday-first columns, the first week padded with `.cell.pad`;
   a month label goes on the column where the month starts, the later month
   winning a shared column. The languages: the eight largest get a colour
   each, the rest fold into "Other". On any failure a section hides its
   figures and shows a link to GitHub.

The workflow's own token sees the public profile and public repositories
only, so by default the language totals cover public code. For the private
repositories too, add a repository secret `DATA_TOKEN`: a fine-grained
personal access token with access to all repositories and only the
mandatory Metadata (read) permission, which is what language statistics
need. The workflow prefers it when present. It also covers the calendar if
GitHub ever refuses the default token for that.

GitHub disables scheduled workflows in a public repository after 60 days
without commits and emails the owner. If the Activity or Stack section goes
stale with no error on the page, check the Actions tab for a disabled Data
workflow first; "Enable workflow" restarts it. A manual run
(`gh workflow run data.yml --ref main`) is only needed for an immediate
refresh or to try a script change.

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
