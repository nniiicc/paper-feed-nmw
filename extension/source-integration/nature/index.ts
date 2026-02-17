// extension/source-integration/nature/index.ts
// Nature.com integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { PaperMetadata } from '../../papers/types';
import { MetadataExtractor, ExtractedMetadata } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('nature-integration');

/**
 * Custom metadata extractor for Nature.com pages
 */
class NatureMetadataExtractor extends MetadataExtractor {
  /**
   * Override title extraction to use meta tag first
   */
  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') || 
                      this.getMetaContent('meta[property="og:title"]');
    return metaTitle || super.extractTitle();
  }
  
  /**
   * Override authors extraction to use meta tag first
   */
  protected extractAuthors(): string {
    // Get all citation_author meta tags (Nature uses one per author)
    const citationAuthors: string[] = [];
    this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) citationAuthors.push(content);
    });
    if (citationAuthors.length > 0) {
      return citationAuthors.join(', ');
    }
    // Fallback to HTML extraction
    const authorElements = this.document.querySelectorAll('.c-article-author-list__item');
    if (authorElements.length > 0) {
      return Array.from(authorElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
    }
    return super.extractAuthors();
  }
  
  /**
   * Extract keywords/tags from document
   */
  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="dc.subject"]');
    
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim());
    }
    
    return [];
  }
  

  /**
   * Override description extraction to use meta tag first
   */
  protected extractDescription(): string {
    const metaDescription = this.getMetaContent('meta[name="description"]') ||
                            this.getMetaContent('meta[property="og:description"]');
    return metaDescription || super.extractDescription();
  }

  /**
   * Override published date extraction to use meta tag
   */
  protected extractPublishedDate(): string {
    return this.getMetaContent('meta[name="citation_publication_date"]') || super.extractPublishedDate();
  }

  /**
   * Override DOI extraction to use meta tag
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
  }
}

/**
 * Nature.com integration with custom metadata extraction
 */
export class NatureIntegration extends BaseSourceIntegration {
  readonly id = 'nature';
  readonly name = 'Nature'; 

  // URL patterns for Nature articles (including all Nature journals)
  readonly urlPatterns = [
    // Main nature.com articles
    /nature\.com\/articles\/([^?#/]+)/,
    // Nature sub-journals (e.g., nature.com/ncomms/articles/...)
    /nature\.com\/\w+\/articles\/([^?#/]+)/,
    // Scientific Reports
    /nature\.com\/srep\/articles\/([^?#/]+)/,
    // Nature Communications
    /nature\.com\/ncomms\/articles\/([^?#/]+)/,
    // Nature Methods, Nature Reviews, etc.
    /nature\.com\/n[a-z]+\/articles\/([^?#/]+)/,
    // DOI-based URLs
    /nature\.com\/doi\/(10\.\d+\/[^?#\s]+)/,
    // Full text and PDF variants
    /nature\.com\/articles\/([^?#/]+)\.pdf/,
    /nature\.com\/articles\/([^?#/]+)\/full/,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /nature\.com\/(articles|doi)\//.test(url) ||
           /nature\.com\/\w+\/articles\//.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract article ID
    const articleMatch = url.match(/nature\.com\/(?:\w+\/)?articles\/([^?#/]+)/);
    if (articleMatch) {
      return articleMatch[1].replace(/\.pdf$/, '');
    }

    // Try DOI format
    const doiMatch = url.match(/nature\.com\/doi\/(10\.\d+\/[^?#\s]+)/);
    if (doiMatch) {
      return doiMatch[1];
    }

    return null;
  }

  /**
   * Create a custom metadata extractor for Nature.com
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new NatureMetadataExtractor(document);
  }
}

// Export a singleton instance 
export const natureIntegration = new NatureIntegration();
