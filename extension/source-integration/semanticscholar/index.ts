// extension/source-integration/semanticscholar/index.ts
// Semantic Scholar integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('semanticscholar-integration');

/**
 * Custom metadata extractor for Semantic Scholar pages
 */
class SemanticScholarMetadataExtractor extends MetadataExtractor {
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
           super.extractPublishedDate();
  }

  /**
   * Extract DOI if available
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
  }

  /**
   * Extract journal/venue name
   */
  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_journal_title"]') ||
           this.getMetaContent('meta[name="citation_conference_title"]') ||
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
 * Semantic Scholar integration
 */
export class SemanticScholarIntegration extends BaseSourceIntegration {
  readonly id = 'semanticscholar';
  readonly name = 'Semantic Scholar';

  // URL patterns for Semantic Scholar papers
  readonly urlPatterns = [
    // Standard paper URL with title slug and corpus ID
    /semanticscholar\.org\/paper\/[^/]+\/([a-f0-9]+)/,
    // Paper URL without title slug (direct ID)
    /semanticscholar\.org\/paper\/([a-f0-9]{40})/,
    // CorpusID-based URL
    /semanticscholar\.org\/paper\/[^?]*[?&]corpusId=(\d+)/,
    // Reader URL
    /semanticscholar\.org\/reader\/([a-f0-9]+)/,
    // Author paper pages
    /semanticscholar\.org\/author\/[^/]+\/papers/,
    // Generic paper pattern
    /semanticscholar\.org\/paper\//,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /semanticscholar\.org\/(paper|reader)\//.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract 40-character hex ID (SHA)
    const shaMatch = url.match(/\/([a-f0-9]{40})/);
    if (shaMatch) {
      return shaMatch[1];
    }

    // Try corpus ID from query params
    const corpusMatch = url.match(/[?&]corpusId=(\d+)/);
    if (corpusMatch) {
      return `corpus:${corpusMatch[1]}`;
    }

    // Try shorter hex ID format
    const shortIdMatch = url.match(/semanticscholar\.org\/(?:paper|reader)\/[^/]*\/([a-f0-9]+)/);
    if (shortIdMatch) {
      return shortIdMatch[1];
    }

    return null;
  }

  /**
   * Create custom metadata extractor for Semantic Scholar
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new SemanticScholarMetadataExtractor(document);
  }
}

// Export singleton instance
export const semanticScholarIntegration = new SemanticScholarIntegration();
