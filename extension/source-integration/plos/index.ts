// extension/source-integration/plos/index.ts
// PLOS integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('plos-integration');

/**
 * Custom metadata extractor for PLOS pages
 */
class PLOSMetadataExtractor extends MetadataExtractor {
  /**
   * Extract title using citation meta tags
   */
  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
                      this.getMetaContent('meta[property="og:title"]') ||
                      this.getMetaContent('meta[name="dc.title"]');
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
           this.getMetaContent('meta[name="citation_date"]') ||
           this.getMetaContent('meta[name="dc.date"]') ||
           super.extractPublishedDate();
  }

  /**
   * Extract DOI
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') ||
           this.getMetaContent('meta[name="dc.identifier"]') ||
           super.extractDoi();
  }

  /**
   * Extract journal name
   */
  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_journal_title"]') ||
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
 * PLOS (Public Library of Science) integration
 */
export class PLOSIntegration extends BaseSourceIntegration {
  readonly id = 'plos';
  readonly name = 'PLOS';

  // URL patterns for PLOS articles (all PLOS journals)
  readonly urlPatterns = [
    // Standard article URLs with DOI parameter
    /journals\.plos\.org\/\w+\/article\?id=(10\.\d+\/[^\s&]+)/,
    // URL encoded DOI format
    /journals\.plos\.org\/\w+\/article\/info[:%]3Adoi[/%]2F(10\.\d+)/,
    // Generic PLOS article URL (for canHandleUrl)
    /journals\.plos\.org\/\w+\/article/,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /journals\.plos\.org\/\w+\/article/.test(url);
  }

  /**
   * Extract paper ID (DOI) from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract DOI from id parameter
    const idMatch = url.match(/[?&]id=(10\.\d+\/[^\s&]+)/);
    if (idMatch) {
      return decodeURIComponent(idMatch[1]);
    }

    // Try URL encoded DOI format
    const encodedMatch = url.match(/doi[/%]2F(10\.\d+[/%]2F[^\s&]+)/i);
    if (encodedMatch) {
      return decodeURIComponent(encodedMatch[1].replace(/%2F/gi, '/'));
    }

    // Fallback: generate from URL
    return null;
  }

  /**
   * Create custom metadata extractor for PLOS
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new PLOSMetadataExtractor(document);
  }
}

// Export singleton instance
export const plosIntegration = new PLOSIntegration();
