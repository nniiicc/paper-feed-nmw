// extension/source-integration/neurips/index.ts
// NeurIPS proceedings integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { MetadataExtractor } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('neurips-integration');

/**
 * Custom metadata extractor for NeurIPS pages
 */
class NeurIPSMetadataExtractor extends MetadataExtractor {
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
    const authorElements = this.document.querySelectorAll('.author a, .author span');
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

    // NeurIPS often has abstract in a specific section
    if (!metaDescription) {
      const abstractSection = this.document.querySelector('.abstract');
      if (abstractSection) {
        return abstractSection.textContent?.trim() || '';
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
           'NeurIPS' ||
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
 * NeurIPS proceedings integration
 */
export class NeurIPSIntegration extends BaseSourceIntegration {
  readonly id = 'neurips';
  readonly name = 'NeurIPS';

  // URL patterns for NeurIPS papers (multiple domains and formats)
  readonly urlPatterns = [
    // proceedings.neurips.cc (current main site)
    /proceedings\.neurips\.cc\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
    /proceedings\.neurips\.cc\/paper\/(\d+)\/file\/([a-f0-9]+)/,
    /proceedings\.neurips\.cc\/paper_files\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
    /proceedings\.neurips\.cc\/paper_files\/paper\/(\d+)\/file\/([a-f0-9]+)/,
    // papers.nips.cc (legacy domain)
    /papers\.nips\.cc\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
    /papers\.nips\.cc\/paper\/(\d+)\/file\/([a-f0-9]+)/,
    /papers\.nips\.cc\/paper_files\/paper\/(\d+)\/hash\/([a-f0-9]+)/,
    // Title-based URLs (older format)
    /papers\.nips\.cc\/paper\/(\d+)-([^\/\s]+)/,
    /proceedings\.neurips\.cc\/paper\/(\d+)-([^\/\s]+)/,
    // Generic NeurIPS paper patterns
    /proceedings\.neurips\.cc\/paper/,
    /papers\.nips\.cc\/paper/,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /proceedings\.neurips\.cc\/paper/.test(url) ||
           /papers\.nips\.cc\/paper/.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try hash/file format (current)
    const hashMatch = url.match(/paper(?:_files)?\/paper\/(\d+)\/(?:hash|file)\/([a-f0-9]+)/);
    if (hashMatch) {
      return `${hashMatch[1]}-${hashMatch[2]}`;
    }

    // Try title-based format (older)
    const titleMatch = url.match(/paper\/(\d+)-([^\/\s.]+)/);
    if (titleMatch) {
      return `${titleMatch[1]}-${titleMatch[2]}`;
    }

    // Try just year + anything
    const yearMatch = url.match(/paper(?:_files)?\/paper\/(\d+)\/([^\/\s]+)/);
    if (yearMatch) {
      return `${yearMatch[1]}-${yearMatch[2]}`;
    }

    return null;
  }

  /**
   * Create custom metadata extractor for NeurIPS
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new NeurIPSMetadataExtractor(document);
  }
}

// Export singleton instance
export const neuripsIntegration = new NeurIPSIntegration();
