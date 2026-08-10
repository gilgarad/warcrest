# GitHub Pages Deployment

## Public URL

The production game is deployed at:

`https://gilgarad.github.io/warcrest/`

## Pipeline

`.github/workflows/deploy-pages.yml` deploys on every push to `master` and can
also be started manually with `workflow_dispatch`.

1. Check out the repository.
2. Install Node 20 and dependencies with `npm ci`.
3. Run `npm run build`.
4. Upload `dist/` as the Pages artifact.
5. Deploy through GitHub's official Pages actions.

The workflow requires repository Pages source to be set to **GitHub Actions**.
No `gh-pages` branch is used.

## Subpath Contract

`vite.config.ts` sets `base` to `/warcrest/`. Runtime assets use
`src/config/assetUrl.ts`, which resolves paths against Vite's `BASE_URL` rather
than the host root. This supports both local development at `/` and the Pages
project path.

## Local Verification

Run:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173/warcrest/`.

The 2026-07-29 deployment smoke test entered the live battle scene from the
production preview with zero failed HTTP responses and zero page errors.
Evidence is stored in `artifacts/deployment/pages-local-smoke.json` and
`artifacts/deployment/pages-local-smoke.png`.
