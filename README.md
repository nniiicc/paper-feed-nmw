# Research Paper Visit/Reading Monitor and Feed

System which passively monitors what you're reading via a browser extension and publishes a feed via gh-pages.

Example feed: https://dmarx.github.io/papers-feed/

# How it works

1. Browser extension monitors your reading habits.
2. Interactions with domains you are interested in get logged as github issues. Whole separate project for this cursed use of gh-issues here: https://github.com/dmarx/gh-store
   * Domains supported out of the box:
     * arxiv
     * openreview
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

**Option A: Temporary installation (for testing)**
```bash
cd extension
npm run firefox:run
```

**Option B: Manual installation**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select any file in the `extension` folder (e.g., `manifest.json`)

> **Note:** Firefox requires version 128+ for full Manifest V3 support.

## Testing your setup

Visit an arxiv `/abs/` or `/pdf/` page. Shortly after:
* An issue with labels should be created in your repo
* Activity will be logged in the repository's `Actions` tab
* After a few minutes, the frontend should be available at `<username>.github.io/<repo-name>`

# Acknowledgements

* Thank you to anthropic for making a decent LLM (I made claude write nearly all of this)
* Thank you also to https://github.com/utterance/utterances, which inspired how this project (ab)uses github issues as a database
