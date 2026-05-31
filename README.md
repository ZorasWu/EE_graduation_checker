# NCU EE 112 Graduation Checker

This repo contains a transcript-first graduation checker for NCU EE students under the 112 curriculum.

## What it ships

- A Chrome-compatible extension rooted at [manifest.json](/E:/side_project/manifest.json)
- A static report UI for GitHub Pages at [docs/index.html](/E:/side_project/docs/index.html)
- Shared parser and rule logic under [docs/app](/E:/side_project/docs/app)

## Important deployment note

This project is not a GitHub Pages-only app.

- GitHub Pages hosts the report UI in `docs/`
- The browser extension performs the authenticated NCU data fetch
- Students must already be logged into the NCU portal in the same browser

If you publish only the `docs/` site without the extension, the report page will load but it will not be able to fetch student data by itself.

## Flow

1. The student logs into the normal NCU portal in the browser.
2. The student clicks the extension action.
3. The extension fetches `transcriptQuery` and `graduateReport` with the existing browser session.
4. The extension creates an EE112 snapshot and opens the report UI.

The extension never asks for account or password in this version.

## Before pushing to GitHub

1. Review [docs/app/ee112-config.js](/E:/side_project/docs/app/ee112-config.js) and confirm the EE112 course mapping and thresholds are correct.
2. Do not add any real student data, passwords, or cookies to the repo.
3. Run `npm test`.

## Publish to GitHub

1. Create a new GitHub repository.
2. Push this whole folder to that repository.
3. Enable GitHub Pages and set the source to the `docs/` folder.
4. Copy the final Pages URL.
5. Paste that URL into `REPORT_SITE_URL` in [docs/app/app-config.js](/E:/side_project/docs/app/app-config.js).
6. Reload the unpacked extension in Chrome so it uses the new hosted report page.

Example:

```js
export const REPORT_SITE_URL = "https://YOUR-ACCOUNT.github.io/YOUR-REPO/";
```

## Local setup and manual test

1. Load the repo root as an unpacked extension in Chrome.
2. Open the NCU portal and sign in normally.
3. Click the extension action to generate a report.

By default, the extension opens the bundled [report.html](/E:/side_project/report.html).  
To switch to a published GitHub Pages site, set `REPORT_SITE_URL` in [docs/app/app-config.js](/E:/side_project/docs/app/app-config.js).

## Publish notes

- Publish `docs/` with GitHub Pages, but publish the whole repo to GitHub.
- Keep the extension root at the repo root so it can import the shared modules from `docs/app`.
- The content bridge is enabled for `https://*.github.io/*`; if you want a narrower host pattern later, update [manifest.json](/E:/side_project/manifest.json).
- If your GitHub Pages URL changes, update `REPORT_SITE_URL` and reload the extension.

## Tests

Run:

```powershell
npm test
```
