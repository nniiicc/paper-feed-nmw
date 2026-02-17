# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Papers Feed is a system that passively monitors academic paper reading habits via a browser extension and publishes a feed via GitHub Pages. The browser extension tracks visits to academic paper sites, logs interactions as GitHub Issues (via [gh-store](https://github.com/dmarx/gh-store)), and GitHub Actions workflows enrich metadata and deploy an interactive frontend.

## Build & Development Commands

### Browser Extension (TypeScript)
```bash
cd extension
npm install
npm run build          # Rollup build → dist/
npm run watch          # Rollup build with file watching
npm run type-check     # TypeScript type checking (tsc --noEmit)
npm run lint           # ESLint
npm run format         # Prettier
npm run clean          # Remove dist/
npm run firefox:run    # Launch Firefox with extension via web-ext
npm run firefox:lint   # Lint extension with web-ext
```

### Python Scripts
```bash
# Run all tests (pytest)
pytest tests/ -v

# Run individual test suites
pytest tests/test_canonical_ids.py        # Canonical ID extraction logic
pytest tests/test_hydrate_metadata.py     # Metadata hydration functions
pytest tests/test_import_browser_history.py  # Browser history import
pytest tests/test_process_pdf.py          # PDF processing/sanitization
pytest tests/test_zotero_sync.py          # Zotero sync (requires pyzotero)

# Key scripts (require env vars: ZOTERO_LIBRARY_ID, ZOTERO_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY)
python scripts/zotero_sync.py --incremental
python scripts/hydrate_metadata.py hydrate_all_open_issues --token=... --repo=...
python scripts/import_browser_history.py --history-file=data.json --token=... --repo=... --dry-run
python scripts/process_pdf.py process_pdf --pdf-path=path/to/file.pdf
```

### Firefox Extension Signing
```bash
cd extension
AMO_JWT_ISSUER=your_key AMO_JWT_SECRET=your_secret npm run firefox:sign
```

## Architecture

### Browser Extension (`extension/`)
- **Manifest V3** with cross-browser support (Chrome + Firefox). Firefox requires 128+.
- **Build**: Rollup bundles TypeScript → `dist/`. Four entry points: `background.ts`, `content.ts`, `popup.ts`, `options.ts`.
- **Cross-browser API**: `utils/browser-api.ts` abstracts `chrome.*` vs `browser.*` namespaces.
- **Source Integration Plugin System**: Each academic source (arxiv, openreview, nature, IEEE, ACM, etc.) implements the `SourceIntegration` interface in `source-integration/`. All are registered in `source-integration/registry.ts`. A source provides: URL pattern matching, paper ID extraction, metadata extraction from DOM, and storage ID formatting. bioRxiv and medRxiv share a common `PreprintIntegration` base class in `source-integration/preprint-base.ts`.
- **Paper Manager** (`papers/manager.ts`): CRUD operations for papers and interaction logs via `gh-store-client`. Papers and interactions are stored as GitHub Issues.
- **Session Tracking** (`utils/session-service.ts`): Heartbeat-based reading session detection.
- **Background Service Worker** (`background.ts`): Initializes gh-store client, source manager, session service. Handles all message passing from content scripts.
- **Content Script** (`content.ts`): Injected on all URLs; detects academic paper pages, extracts metadata via the matching source integration, and communicates with background via messages.

### Python Scripts (`scripts/`)
- `zotero_sync.py`: Syncs Zotero library → gh-store issues (incremental/historical/init modes)
- `hydrate_metadata.py`: Enriches paper metadata from external APIs
- `process_pdf.py`: PDF processing pipeline
- `import_browser_history.py`: One-time import from browser history

### Frontend (`frontend/`)
- Static site deployed to GitHub Pages (`gh-pages` branch). Single `index.html` + `papersfeed.js` + `papersfeed.css`.

### GitHub Actions (`.github/workflows/`)
- `1_update_and_enrich.yml`: Fetches store snapshot, enriches metadata, deploys
- `2_deploy-frontend.yml`: Deploys frontend to gh-pages
- `build-extension.yml`: Builds extension, commits bundles to repo
- `sign-firefox-extension.yml`: Signs extension via AMO, creates GitHub Release with `.xpi`
- `deduplicate-ghstore.yml` / `ghstore-process-bulk.yml`: Store maintenance

## Key Patterns

- **gh-store**: GitHub Issues are used as a key-value database. The `gh-store-client` npm package and corresponding Python client handle all CRUD. Object IDs follow the pattern `{type}/{sourceId}/{paperId}`.
- **Extension manifest** includes both `service_worker` (Chrome) and `scripts` (Firefox) fields in `background` for cross-browser compat. The `browser_specific_settings.gecko` section sets the Firefox add-on ID.
- **Source integrations** are the primary extension point. To add a new academic source, create a new file in `source-integration/`, implement `SourceIntegration`, and register it in `registry.ts`. For preprint servers similar to bioRxiv/medRxiv, extend `PreprintIntegration` from `preprint-base.ts`.
- **XSS prevention**: All user-controlled strings (paper titles, authors, abstracts, tags) must be escaped via `escapeHtml()` before inserting into `innerHTML`. The extension uses `escapeHtml` in `popup-manager.ts`, and the frontend has its own `escapeHtml` in `papersfeed.js`.
- **Firefox signing**: The extension is signed via AMO (addons.mozilla.org) for permanent Firefox installation. The `sign-firefox-extension.yml` workflow automates this. Requires `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets.
- **Test mocking**: Python test files mock unavailable dependencies (`arxiv`, `gh_store`, `llamero`, `pyzotero`) via `sys.modules.setdefault()` so pure-logic tests run without installing all deps.
