# app.choonsiong.com

The landing page for the web apps I build and run, served from GitHub Pages
at <https://app.choonsiong.com>.

## What's on it

The page lists each app with a short description and a link to where it runs:

| App | Where | Source |
|---|---|---|
| HideIt | <https://app.choonsiong.com/hideit/> | [choonsiong/hideit](https://github.com/choonsiong/hideit) |
| Flashcards | <https://app.choonsiong.com/flashcards/> | [choonsiong/flashcards](https://github.com/choonsiong/flashcards) |
| Tasks | <https://tasks.choonsiong.com> | private |
| Spending | <https://spending.choonsiong.com> | private |
| Docs | <https://docs.choonsiong.com> | private |

HideIt and Flashcards are static sites published to this same Pages host
from their own repositories, which is why they live under `/hideit/` and
`/flashcards/`. The other three are self-hosted services and only link out
from here.

Below the apps, an Activity section shows my GitHub contribution calendar
for the last year, and a Stack section shows how much of my code is in
each language, as a ring you can spin (see "The data branch" below).

## How it's built

Three files and no build step:

- `index.html` holds the content. The app cards are plain `<article>` blocks
  in the `#apps` section; add, edit or remove them there.
- `style.css` holds the layout and theme.
- `main.js` draws the background scene and the Stack ring with three.js,
  loaded as an ES module from jsDelivr through the import map in
  `index.html`. Everything that is not 3D (nav, reveal-on-scroll, card glow,
  the contribution calendar, the language list) runs even where WebGL is
  unavailable; there the ring gives way to a thin segmented bar.

### The data branch

The Activity section draws `contributions.json`: a day per entry, with its
count and GitHub's 0–4 level. The Stack section draws `languages.json`:
bytes of source per language, as GitHub detects them, summed over every
repository I own (forks excluded), with the number of repositories each
appears in. Both are only available through GitHub's GraphQL API, which
needs a token, so the browser can't fetch them from GitHub directly.
Instead `.github/workflows/data.yml` runs `.github/scripts/contributions.sh`
and `.github/scripts/languages.sh` once a day (and on demand from the
Actions tab) and commits the files to the `data` branch, which holds
nothing else. The page reads them from
`https://raw.githubusercontent.com/choonsiong/choonsiong.github.io/data/`,
so refreshing them touches neither `main` nor the releases. If a file can't
be loaded, its section shows a link to GitHub instead.

The workflow's own token sees public repositories only. To count private
ones as well, add a repository secret `DATA_TOKEN` holding a fine-grained
personal access token with access to all repositories and just the
Metadata permission (read, the minimum); the page publishes totals per
language, never repository names. To produce the files locally with `gh`
and `jq` installed: `.github/scripts/contributions.sh choonsiong` and
`.github/scripts/languages.sh choonsiong` (both outputs are git-ignored,
and the page served from localhost reads them before the published ones).

The schedule needs no attention, with one caveat: GitHub pauses scheduled
workflows in a public repository after 60 days without commits and sends
an email when it does. If the calendar or the languages stop refreshing,
"Enable workflow" on the Data workflow in the Actions tab starts them
again.

`CNAME` sets the custom domain and `.nojekyll` stops GitHub Pages from
running the files through Jekyll.

## Run it locally

Any static file server works. ES modules don't load from `file://`, so open
the page over HTTP:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying and releases

Pushing to `main` deploys the site: GitHub Pages serves the repository as is.

Changes reach `main` through pull requests. After each merge, `main` is
tagged with the next version: minor (`v0.1.0` → `v0.2.0`) when a `feat/`
branch was merged, otherwise patch (`v0.1.0` → `v0.1.1`). Pushing a
`vX.Y.Z` tag runs `.github/workflows/release.yml`, which publishes the
"vX.Y.Z release" GitHub release with notes generated from the merged pull
requests. It refuses tags that aren't on `main`. A release doesn't deploy
anything; the push to `main` already did.

## License

[MIT](./LICENSE)
