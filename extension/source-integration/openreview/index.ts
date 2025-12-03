// extension/source-integration/openreview/index.ts
// OpenReview integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { PaperMetadata } from '../../papers/types';
import { MetadataExtractor, createMetadataExtractor, ExtractedMetadata } from '..//metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('openreview-integration');

/**
 * Custom metadata extractor for OpenReview pages
 */
class OpenReviewMetadataExtractor extends MetadataExtractor {
  /**
   * Extract metadata from OpenReview pages
   */
  public extract(): ExtractedMetadata {
    // First try to extract using standard methods
    const baseMetadata = super.extract();
    
    try {
      // Get title from OpenReview-specific elements
      const title = this.document.querySelector('.citation_title')?.textContent || 
                   this.document.querySelector('.forum-title h2')?.textContent;
      
      // Get authors
      const authorElements = Array.from(this.document.querySelectorAll('.forum-authors a'));
      const authors = authorElements
        .map(el => el.textContent)
        .filter(Boolean)
        .join(', ');
      
      // Get abstract
      const abstract = this.document.querySelector('meta[name="citation_abstract"]')?.getAttribute('content') ||
                     Array.from(this.document.querySelectorAll('.note-content-field'))
                       .find(el => el.textContent?.includes('Abstract'))
                       ?.nextElementSibling?.textContent;
      
      // Get publication date
      const dateText = this.document.querySelector('.date.item')?.textContent;
      let publishedDate = '';
      if (dateText) {
        const dateMatch = dateText.match(/Published: ([^,]+)/);
        if (dateMatch) {
          publishedDate = dateMatch[1];
        }
      }
      
      // Get DOI if available
      const doi = this.document.querySelector('meta[name="citation_doi"]')?.getAttribute('content') || '';
      
      // Get conference/journal name
      const venueElements = this.document.querySelectorAll('.forum-meta .item');
      let venue = '';
      for (let i = 0; i < venueElements.length; i++) {
        const el = venueElements[i];
        if (el.querySelector('.glyphicon-folder-open')) {
          venue = el.textContent?.trim() || '';
          break;
        }
      }
      
      // Get tags/keywords
      const keywordsElement = Array.from(this.document.querySelectorAll('.note-content-field'))
        .find(el => el.textContent?.includes('Keywords'));
      let tags: string[] = [];
      if (keywordsElement) {
        const keywordsValue = keywordsElement.nextElementSibling?.textContent;
        if (keywordsValue) {
          tags = keywordsValue.split(',').map(tag => tag.trim());
        }
      }
      
      return {
        title: title || baseMetadata.title,
        authors: authors || baseMetadata.authors,
        description: abstract || baseMetadata.description,
        publishedDate: publishedDate || baseMetadata.publishedDate,
        doi: doi || baseMetadata.doi,
        journalName: venue || baseMetadata.journalName,
        tags: tags.length ? tags : baseMetadata.tags,
        url: this.url
      };
    } catch (error) {
      logger.error('Error during OpenReview-specific extraction', error);
      return baseMetadata;
    }
  }
}

/**
 * OpenReview integration with custom metadata extraction
 */
export class OpenReviewIntegration extends BaseSourceIntegration {
  readonly id = 'openreview';
  readonly name = 'OpenReview';
  
  // URL patterns for papers (various OpenReview formats)
  readonly urlPatterns = [
    // Forum page (main paper page)
    /openreview\.net\/forum\?id=([a-zA-Z0-9_-]+)/,
    // PDF page
    /openreview\.net\/pdf\?id=([a-zA-Z0-9_-]+)/,
    // Attachment URLs
    /openreview\.net\/attachment\?id=([a-zA-Z0-9_-]+)/,
    // References/revisions
    /openreview\.net\/references\?referent=([a-zA-Z0-9_-]+)/,
    /openreview\.net\/revisions\?id=([a-zA-Z0-9_-]+)/,
    // Group/venue pages (for browsing)
    /openreview\.net\/group\?id=([^&\s]+)/,
    // Generic OpenReview paper URL
    /openreview\.net\/(?:forum|pdf)\?id=/,
  ];

  /**
   * Check if this integration can handle the given URL
   */
  canHandleUrl(url: string): boolean {
    return /openreview\.net\/(forum|pdf|attachment|references|revisions)\?id=/.test(url);
  }

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    // Try to extract ID from various URL formats
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return idMatch[1];
    }

    // Try referent parameter
    const referentMatch = url.match(/[?&]referent=([a-zA-Z0-9_-]+)/);
    if (referentMatch) {
      return referentMatch[1];
    }

    return null;
  }

  /**
   * Create a custom metadata extractor for OpenReview
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new OpenReviewMetadataExtractor(document);
  }

  /**
   * Extract metadata from page
   * Override parent method to handle OpenReview-specific extraction
   */
  async extractMetadata(document: Document, paperId: string): Promise<PaperMetadata | null> {
    logger.info(`Extracting metadata for OpenReview ID: ${paperId}`);
    
    // Extract metadata using our custom extractor
    const metadata = await super.extractMetadata(document, paperId);
    
    if (metadata) {
      // Add any OpenReview-specific metadata processing here
      logger.debug('Extracted metadata from OpenReview page');
      
      // Check if we're on a PDF page and adjust metadata accordingly
      if (document.location.href.includes('/pdf?id=')) {
        metadata.sourceType = 'pdf';
      }
    }
    
    return metadata;
  }
}

// Export a singleton instance that can be used by both background and content scripts
export const openReviewIntegration = new OpenReviewIntegration();
