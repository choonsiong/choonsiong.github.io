# app.choonsiong.com

The landing page for the web apps I build and run, served from GitHub Pages
at <https://app.choonsiong.com>.

## What's on it

The page lists each app with a short description and a link to where it runs:

| App | Where | Source |
|---|---|---|
| HideIt | <https://app.choonsiong.com/hideit/> | [choonsiong/hideit](https://github.com/choonsiong/hideit) |
| Tasks | <https://tasks.choonsiong.com> | private |
| Spending | <https://spending.choonsiong.com> | private |
| Docs | <https://docs.choonsiong.com> | private |

HideIt is a static site published to this same Pages host from its own
repository, which is why it lives under `/hideit/`. The other three are
self-hosted services and only link out from here.

## How it's built

Three files and no build step:

- `index.html` holds the content. The app cards are plain `<article>` blocks
  in the `#apps` section; add, edit or remove them there.
- `style.css` holds the layout and theme.
- `main.js` draws the background scene with three.js, loaded as an ES module
  from jsDelivr through the import map in `index.html`. Everything that is not
  3D (nav, reveal-on-scroll, card glow) runs even where WebGL is unavailable.

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
