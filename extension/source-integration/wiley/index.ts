// extension/source-integration/wiley/index.ts
// Wiley Online Library integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('wiley-integration');

/**
 * Custom metadata extractor for Wiley pages
 */
class WileyMetadataExtractor extends MetadataExtractor {
  /**
   * Extract title using citation meta tags
   */
  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
                      this.getMetaContent('meta[property="og:title"]') ||
                      this.getMetaContent('meta[name="dc.Title"]');
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

    return super.extractAuthors();
  }

  /**
   * Extract abstract/description
   */
  protected extractDescription(): string {
    const metaDescription = this.getMetaContent('meta[name="description"]') ||
                            this.getMetaContent('meta[property="og:description"]');
    return metaDescription || super.extractDescription();
  }

  /**
   * Extract publication date
   */
  protected extractPublishedDate(): string {
    return this.getMetaContent('meta[name="citation_publication_date"]') ||
           this.getMetaContent('meta[name="citation_online_date"]') ||
           this.getMetaContent('meta[name="dc.Date"]') ||
           super.extractPublishedDate();
  }

  /**
   * Extract DOI
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') ||
           this.getMetaContent('meta[name="dc.Identifier"]') ||
           super.extractDoi();
  }

  /**
   * Extract journal name
   */
  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_journal_title"]') ||
           this.getMetaContent('meta[name="dc.Source"]') ||
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
 * Wiley Online Library integration
 */
export class WileyIntegration extends BaseSourceIntegration {
  readonly id = 'wiley';
  readonly name = 'Wiley Online Library';

  // URL patterns for Wiley articles
  readonly urlPatterns = [
    // Standard DOI URLs
    /onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
    /onlinelibrary\.wiley\.com\/doi\/abs\/(10\.\d+\/[^\s?#]+)/,
    /onlinelibrary\.wiley\.com\/doi\/full\/(10\.\d+\/[^\s?#]+)/,
    /onlinelibrary\.wiley\.com\/doi\/pdf\/(10\.\d+\/[^\s?#]+)/,
    /onlinelibrary\.wiley\.com\/doi\/epdf\/(10\.\d+\/[^\s?#]+)/,
    // Wiley society journals (e.g., physoc.onlinelibrary.wiley.com)
    /\w+\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
    /\w+\.onlinelibrary\.wiley\.com\/doi\/abs\/(10\.\d+\/[^\s?#]+)/,
    /\w+\.onlinelibrary\.wiley\.com\/doi\/full\/(10\.\d+\/[^\s?#]+)/,
    // AGU Publications (agupubs)
    /agupubs\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
    // FEBS journals
    /febs\.onlinelibrary\.wiley\.com\/doi\/(10\.\d+\/[^\s?#]+)/,
    // Generic Wiley DOI pattern
    /onlinelibrary\.wiley\.com\/doi\//,
    /\.onlinelibrary\.wiley\.com\/doi\//,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /\.?onlinelibrary\.wiley\.com\/doi\//.test(url);
  }

  /**
   * Extract paper ID (DOI) from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract DOI from URL path (handles all variants)
    const doiMatch = url.match(/\/doi\/(?:abs|full|pdf|epdf)?\/?((10\.\d+\/[^\s?#]+))/);
    if (doiMatch) {
      return doiMatch[2] || doiMatch[1];
    }

    return null;
  }

  /**
   * Create custom metadata extractor for Wiley
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new WileyMetadataExtractor(document);
  }
}

// Export singleton instance
export const wileyIntegration = new WileyIntegration();
