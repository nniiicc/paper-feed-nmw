// extension/source-integration/pnas/index.ts
import { BaseSourceIntegration } from '../base-source';

export class PnasIntegration extends BaseSourceIntegration {
  readonly id = 'pnas';
  readonly name = 'PNAS';

  // URL patterns for PNAS articles
  readonly urlPatterns = [
    // DOI-based URLs (most common)
    /pnas\.org\/doi\/(10\.1073\/pnas\.[0-9]+)/,
    /pnas\.org\/doi\/abs\/(10\.1073\/pnas\.[0-9]+)/,
    /pnas\.org\/doi\/full\/(10\.1073\/pnas\.[0-9]+)/,
    /pnas\.org\/doi\/pdf\/(10\.1073\/pnas\.[0-9]+)/,
    /pnas\.org\/doi\/epdf\/(10\.1073\/pnas\.[0-9]+)/,
    // Alternate DOI formats
    /pnas\.org\/doi\/(10\.1073\/[^\s?#]+)/,
    // Content-based URLs (older format)
    /pnas\.org\/content\/(\d+\/\d+\/[^\s?#]+)/,
    /pnas\.org\/content\/early\/\d+\/\d+\/\d+\/(\d+)/,
    // Legacy cgi format
    /pnas\.org\/cgi\/doi\/(10\.1073\/[^\s?#]+)/,
    // Generic PNAS DOI pattern
    /pnas\.org\/doi\//,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /pnas\.org\/(doi|content|cgi)\//.test(url);
  }

  /**
   * Extract paper ID (DOI) from URL
   */
  extractPaperId(url: string): string | null {
    // Try DOI format
    const doiMatch = url.match(/pnas\.org\/(?:doi\/(?:abs|full|pdf|epdf)?\/?)?(10\.1073\/[^\s?#]+)/);
    if (doiMatch) {
      return doiMatch[1];
    }

    // Try content-based format
    const contentMatch = url.match(/content\/(\d+\/\d+\/[^\s?#.]+)/);
    if (contentMatch) {
      return contentMatch[1];
    }

    // Try early format
    const earlyMatch = url.match(/early\/\d+\/\d+\/\d+\/(\d+)/);
    if (earlyMatch) {
      return earlyMatch[1];
    }

    return null;
  }
}

export const pnasIntegration = new PnasIntegration();
