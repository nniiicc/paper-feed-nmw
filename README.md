# Research Paper Visit/Reading Monitor and Feed

System which passively monitors what you're reading via a browser extension and publishes a feed via gh-pages.

Example feed: https://dmarx.github.io/papers-feed/

# How it works

1. Browser extension monitors your reading habits.
2. Interactions with domains you are interested in get logged as github issues. Whole separate project for this cursed use of gh-issues here: https://github.com/dmarx/gh-store
   * Domains supported out of the box:
     * arXiv, OpenReview, Nature, Springer, ScienceDirect, Wiley, IEEE, ACM, PLOS, bioRxiv, medRxiv, SSRN, PubMed, Semantic Scholar, NeurIPS, CVF, ACL, PNAS
   * Can also manually trigger extension to log any page via a popup
4. Github automation workflows update an interactive webpage.

# How to set this up to monitor your own reading

1. Create a new repository from the template here: https://github.com/dmarx/papers-feed-template
2. Configure repository settings
  * [Configure github pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch) to deploy from the `gh-pages` branch
  * Give actions write permissions on your repo
3. Install the browser extension (see below)
4. [Create a github PAT](https://github.blog/security/application-security/introducing-fine-grained-personal-access-tokens-for-github/#creating-personal-access-tokens) with permission to create issues on your papers-feed repo
5. Register the PAT in the browser extension's options

## Installing the Browser Extension

### Build the extension (required for both browsers)

```bash
cd extension
npm install
npm run build
```

### Chrome / Edge / Chromium

1. Navigate to `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder

### Firefox

**Option A: Install signed extension (recommended — persists across restarts/updates)**
1. Download the latest `.xpi` from [GitHub Releases](../../releases)
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon → "Install Add-on From File..."
4. Select the downloaded `.xpi` file

**Option B: Temporary installation (for development only — removed on restart)**
```bash
cd extension
npm run firefox:run
```

Or manually: navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select `manifest.json`.

> **Note:** Firefox requires version 128+ for full Manifest V3 support.

#### Signing the extension yourself

To produce a signed `.xpi` for Firefox:
1. Get API credentials from https://addons.mozilla.org/developers/addon/api/key/
2. Run:
```bash
cd extension
AMO_JWT_ISSUER=your_key AMO_JWT_SECRET=your_secret npm run firefox:sign
```
3. The signed `.xpi` will be in `web-ext-artifacts/`

This is also automated via GitHub Actions (requires `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets). On each push to `main` that changes `extension/`, the workflow signs the extension and creates a GitHub Release with the `.xpi` attached.

## Running Tests

```bash
# Run all Python tests
pytest tests/ -v

# Run specific test suites
pytest tests/test_canonical_ids.py          # Canonical ID extraction
pytest tests/test_hydrate_metadata.py       # arXiv metadata functions
pytest tests/test_import_browser_history.py # URL pattern matching, ID shortening
pytest tests/test_process_pdf.py            # PDF text sanitization
pytest tests/test_zotero_sync.py            # Zotero sync (needs pyzotero)

# Type-check the extension
cd extension && npm run type-check
```

## Testing your setup

Visit an arxiv `/abs/` or `/pdf/` page. Shortly after:
* An issue with labels should be created in your repo
* Activity will be logged in the repository's `Actions` tab
* After a few minutes, the frontend should be available at `<username>.github.io/<repo-name>`

## Zotero Integration (Optional)

Sync your Zotero library to paper-feed. Papers are deduplicated by arXiv ID, DOI, or title hash.

### Setup

1. **Get your Zotero credentials:**
   - Go to https://www.zotero.org/settings/keys
   - Note your **Library ID** (numeric, shown at top)
   - Create a new API key with read access to your library

2. **Add secrets to your GitHub repository:**
   - Go to Settings → Secrets and variables → Actions
   - Add these repository secrets:
     - `ZOTERO_LIBRARY_ID` - Your numeric library ID
     - `ZOTERO_API_KEY` - Your API key

3. **Enable the workflow:**
   - Copy `zotero-sync.yml` to `.github/workflows/zotero-sync.yml`
   - Or set repository variable `ENABLE_ZOTERO_SYNC` to `true`

### Sync Modes

The workflow runs automatically every 6 hours, or manually via Actions tab:

| Mode | Description |
|------|-------------|
| `incremental` | Only sync items changed since last sync (default) |
| `historical` | Sync items from last N days |
| `init` | Initialize sync marker without importing history |

### Manual Sync Options

From the Actions tab, you can:
- Choose sync mode (incremental/historical/init)
- Set days to look back (historical mode)
- Filter to a specific Zotero collection
- Skip updating existing items

### Local Usage

```bash
# Set environment variables
export ZOTERO_LIBRARY_ID="your_library_id"
export ZOTERO_API_KEY="your_api_key"
export GITHUB_TOKEN="your_github_pat"
export GITHUB_REPOSITORY="username/repo"

# List your collections
python scripts/zotero_sync.py --list-collections

# Initialize (start tracking from now, no historical import)
python scripts/zotero_sync.py --init

# Sync incrementally (only new changes)
python scripts/zotero_sync.py --incremental

# Sync last 30 days
python scripts/zotero_sync.py --days 30

# Sync specific collection
python scripts/zotero_sync.py --days 14 --collection "To Read"
```

# Acknowledgements

* Thank you to anthropic for making a decent LLM (I made claude write nearly all of this)
* Thank you also to https://github.com/utterance/utterances, which inspired how this project (ab)uses github issues as a database
