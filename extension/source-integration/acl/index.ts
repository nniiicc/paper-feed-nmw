// extension/source-integration/acl/index.ts
// ACL Anthology integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('acl-integration');

/**
 * Custom metadata extractor for ACL Anthology pages
 */
class ACLMetadataExtractor extends MetadataExtractor {
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
    const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
                            this.getMetaContent('meta[name="description"]') ||
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
   * Extract DOI
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
  }

  /**
   * Extract conference name
   */
  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_conference_title"]') ||
           this.getMetaContent('meta[name="citation_journal_title"]') ||
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
 * ACL Anthology integration for computational linguistics papers
 */
export class ACLIntegration extends BaseSourceIntegration {
  readonly id = 'acl';
  readonly name = 'ACL Anthology';

  // URL patterns for ACL Anthology papers (various formats)
  readonly urlPatterns = [
    // Current ACL Anthology format (e.g., 2023.acl-main.1)
    /aclanthology\.org\/([A-Z0-9]+\.\d+-[a-z]+-\d+)/i,
    /aclanthology\.org\/([A-Z0-9]+\.\d+-\d+)/,
    // Older ACL Anthology format (e.g., P18-1001)
    /aclanthology\.org\/([A-Z]\d{2}-\d+)/,
    // Legacy aclweb.org URLs
    /aclweb\.org\/anthology\/([A-Z0-9]+\.\d+-\d+)/,
    /aclweb\.org\/anthology\/([A-Z]\d{2}-\d+)/,
    // PDF variants
    /aclanthology\.org\/([^\/]+)\.pdf/,
    // Volumes
    /aclanthology\.org\/volumes\/([^\/\s?#]+)/,
    // Generic ACL patterns
    /aclanthology\.org\/[A-Z0-9]/i,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /aclanthology\.org\/[A-Z0-9]/i.test(url) ||
           /aclweb\.org\/anthology\//.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try new format (e.g., 2023.acl-main.1)
    const newFormatMatch = url.match(/aclanthology\.org\/([A-Z0-9]+\.[a-z0-9-]+)/i);
    if (newFormatMatch) {
      return newFormatMatch[1].replace(/\.pdf$/, '');
    }

    // Try old format (e.g., P18-1001)
    const oldFormatMatch = url.match(/(?:aclanthology|aclweb)\.org\/(?:anthology\/)?([A-Z]\d{2}-\d+)/);
    if (oldFormatMatch) {
      return oldFormatMatch[1];
    }

    // Try volume format
    const volumeMatch = url.match(/volumes\/([^\/\s?#]+)/);
    if (volumeMatch) {
      return volumeMatch[1];
    }

    return null;
  }

  /**
   * Create custom metadata extractor for ACL
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new ACLMetadataExtractor(document);
  }
}

// Export singleton instance
export const aclIntegration = new ACLIntegration();
