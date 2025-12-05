// utils/browser-api.ts
// Cross-browser API abstraction for Chrome and Firefox compatibility

/**
 * Cross-browser extension API
 *
 * Firefox uses the `browser` namespace with Promise-based APIs
 * Chrome uses the `chrome` namespace (now also supports Promises in MV3)
 *
 * This abstraction provides a unified interface that works in both browsers.
 */

// Declare browser global for Firefox
declare const browser: typeof chrome | undefined;

// Use browser namespace if available (Firefox), otherwise fall back to chrome (Chrome/Edge)
const browserAPI: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

export { browserAPI as browser };
