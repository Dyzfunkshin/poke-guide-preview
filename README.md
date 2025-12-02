# Poke Guide – build and deploy

## Overview
- Static site (HTML/CSS/JS). Content sections are loaded via `script.js` from `content/*.html`.
- Hosted on GitHub Pages.
- Two deploy targets:
  - **Production:** `main` → GitHub Pages for `poke-guide.com` (this repo).
  - **Preview:** `dev` → `gh-pages` of `Dyzfunkshin/poke-server-preview` (separate repo) for staging.

## Local development
1) Serve over HTTP so `fetch("content/*.html")` works (file:// will break). Easiest: open the folder in VS Code, right‑click `index.html`, choose “Open with Live Server.” Or run `python -m http.server 8000` from repo root, then open http://localhost:8000.
2) Edit and reload. The sidebar ToC is built client-side after the sections load.

## Workflows

### Preview deploy (`dev` branch)
- Workflow: `.github/workflows/deploy-preview.yml`
- Trigger: push to `dev`.
- Steps: checkout → copy files to `_site` → push `_site` to `gh-pages` on `Dyzfunkshin/poke-server-preview` via `peaceiris/actions-gh-pages`.
- Secret required in **this** repo (`poke-guide`):
  - `PREVIEW_TOKEN`: PAT with `repo` scope and write access to `Dyzfunkshin/poke-server-preview`.
- First run creates `gh-pages`; GitHub Pages on the preview repo serves the staged site.

### Production deploy (`main` branch)
- Workflow: `.github/workflows/deploy-production.yml`
- Trigger: push to `main`.
- Steps: checkout → copy files to `_site` → upload artifact → deploy to GitHub Pages using `GITHUB_TOKEN`.
- No extra secrets needed; uses the built-in Pages deploy action.

## Notes
- Keep `content/*.html` UTF-8 to avoid mojibake in the UI.
- The ToC builder expects `<h2>/<h3>/<h4>` ids; it will auto-slug missing ids.
- If preview target changes, update `external_repository` in `deploy-preview.yml` and ensure `PREVIEW_TOKEN` covers that repo.

## Local tests (lint + basic UI checks)
1) Install tools once: `npm install` (dev deps: html-validate, stylelint, eslint, Playwright, axe-core).
2) Run all checks: `npm test` (lints HTML/CSS/JS, then runs Playwright ToC scroll test and axe accessibility scan).
3) Individual commands:
   - `npm run lint:html`
   - `npm run lint:css`
   - `npm run lint:js`
   - `npm run test:toc`
   - `npm run test:axe`
Playwright tests auto-start a local server on port 4173 via `python -m http.server 4173`. Keep the port free before running.
