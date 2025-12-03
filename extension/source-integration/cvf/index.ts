// extension/source-integration/cvf/index.ts
// CVF Open Access integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('cvf-integration');

/**
 * Custom metadata extractor for CVF pages
 */
class CVFMetadataExtractor extends MetadataExtractor {
  /**
   * Extract title using citation meta tags
   */
  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
                      this.getMetaContent('meta[property="og:title"]');
    return metaTitle || super.extractTitle();
  }

  /**
   * Extract authors from citation meta tags
   */
  protected extractAuthors(): string {
    const citationAuthors: string[] = [];
    this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) citationAuthors.push(content);
    });

    if (citationAuthors.length > 0) {
      return citationAuthors.join(', ');
    }

    // Fallback to HTML extraction
    const authorElements = this.document.querySelectorAll('.author a, #authors b');
    if (authorElements.length > 0) {
      return Array.from(authorElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
    }

    return super.extractAuthors();
  }

  /**
   * Extract abstract/description
   */
  protected extractDescription(): string {
    const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
                            this.getMetaContent('meta[name="description"]') ||
                            this.getMetaContent('meta[property="og:description"]');

    // CVF has abstract in a specific div
    if (!metaDescription) {
      const abstractDiv = this.document.querySelector('#abstract');
      if (abstractDiv) {
        return abstractDiv.textContent?.trim() || '';
      }
    }

    return metaDescription || super.extractDescription();
  }

  /**
   * Extract publication date
   */
  protected extractPublishedDate(): string {
    return this.getMetaContent('meta[name="citation_publication_date"]') ||
           this.getMetaContent('meta[name="citation_date"]') ||
           super.extractPublishedDate();
  }

  /**
   * Extract conference name
   */
  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_conference_title"]') ||
           super.extractJournalName();
  }

  /**
   * Extract keywords/tags
   */
  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
                    this.getMetaContent('meta[name="keywords"]');

    if (keywords) {
      return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
    }

    return super.extractTags();
  }
}

/**
 * CVF Open Access integration for CVPR, ICCV, WACV
 */
export class CVFIntegration extends BaseSourceIntegration {
  readonly id = 'cvf';
  readonly name = 'CVF Open Access';

  // URL patterns for CVF papers (CVPR, ICCV, WACV, etc.)
  readonly urlPatterns = [
    // HTML paper pages
    /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]html[_\/]([^.]+)\.html/i,
    /openaccess\.thecvf\.com\/content\/([A-Z]+)(\d+)[_\/]html[_\/]([^.]+)\.html/i,
    // PDF papers
    /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]papers[_\/]([^.]+)\.pdf/i,
    /openaccess\.thecvf\.com\/content\/([A-Z]+)(\d+)[_\/]papers[_\/]([^.]+)\.pdf/i,
    // Workshop papers
    /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]W\d+[_\/]html[_\/]([^.]+)\.html/i,
    /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]W\d+[_\/]papers[_\/]([^.]+)\.pdf/i,
    // Supplementary materials
    /openaccess\.thecvf\.com\/content[_\/]([A-Z]+)[_\/](\d+)[_\/]supplemental[_\/]([^.]+)/i,
    // Generic CVF content pattern
    /openaccess\.thecvf\.com\/content/,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /openaccess\.thecvf\.com\/content/.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract conference, year, and paper name from various formats
    // Format 1: content_CONF_YEAR/html/paper.html
    const format1 = url.match(/content[_\/]([A-Z]+)[_\/](\d+)[_\/](?:W\d+[_\/])?(?:html|papers)[_\/]([^.\/]+)/i);
    if (format1) {
      return `${format1[1]}-${format1[2]}-${format1[3]}`;
    }

    // Format 2: content/CONFYEAR/html/paper.html
    const format2 = url.match(/content\/([A-Z]+)(\d{4})[_\/](?:W\d+[_\/])?(?:html|papers)[_\/]([^.\/]+)/i);
    if (format2) {
      return `${format2[1]}-${format2[2]}-${format2[3]}`;
    }

    // Fallback: just extract the paper name from the path
    const fallback = url.match(/\/([^\/]+)\.(?:html|pdf)$/);
    if (fallback) {
      return fallback[1];
    }

    return null;
  }

  /**
   * Create custom metadata extractor for CVF
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new CVFMetadataExtractor(document);
  }
}

// Export singleton instance
export const cvfIntegration = new CVFIntegration();
