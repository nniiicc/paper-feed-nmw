// extension/source-integration/metadata-extractor.ts
// Object-oriented metadata extraction system with customizable extraction methods

import { loguru } from '../utils/logger';

const logger = loguru.getLogger('metadata-extractor');

export interface ExtractedMetadata {
  title: string;
  authors: string;
  description: string;
  publishedDate: string;
  doi?: string;
  journalName?: string;
  tags?: string[];
  url?: string;
}

// Constants for standard source types
export const SOURCE_TYPES = {
  PDF: 'pdf',
  URL: 'url',
} as const;

export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];

/**
 * Base class for metadata extraction with customizable extraction methods
 * Each method can be overridden to provide source-specific extraction
 */
export class MetadataExtractor {
  protected document: Document;
  protected url: string;
  
  /**
   * Create a new metadata extractor for a document
   */
  constructor(document: Document) {
    this.document = document;
    this.url = document.location.href;
    logger.debug('Initialized metadata extractor for:', this.url);
  }
  
  /**
   * Helper method to get content from meta tags
   */
  protected getMetaContent(selector: string): string {
    const element = this.document.querySelector(selector);
    return element ? element.getAttribute('content') || '' : '';
  }
  
  /**
   * Extract and return all metadata fields
   */
  public extract(): ExtractedMetadata {
    logger.debug('Extracting metadata from page:', this.url);
    
    const metadata: ExtractedMetadata = {
      title: this.extractTitle(),
      authors: this.extractAuthors(),
      description: this.extractDescription(),
      publishedDate: this.extractPublishedDate(),
      doi: this.extractDoi(),
      journalName: this.extractJournalName(),
      tags: this.extractTags(),
      url: this.url
    };
    
    logger.debug('Metadata extraction complete:', metadata);
    return metadata;
  }
  
  /**
   * Extract title from document
   * Considers multiple metadata standards with priority order, then DOM fallbacks
   */
  protected extractTitle(): string {
    // Title extraction from meta tags - priority order
    const metaTitle = (
      // Dublin Core
      this.getMetaContent('meta[name="DC.Title"]') || this.getMetaContent('meta[name="dc.title"]') ||
      // Citation
      this.getMetaContent('meta[name="citation_title"]') ||
      // Open Graph
      this.getMetaContent('meta[property="og:title"]') ||
      // Standard meta
      this.getMetaContent('meta[name="title"]')
    );

    if (metaTitle) {
      return metaTitle;
    }

    // DOM-based fallback extraction
    // Look for common paper title patterns in the page
    const titleSelectors = [
      // Common academic page patterns
      'h1.title', 'h1.article-title', 'h1.paper-title', 'h1.document-title',
      '.title h1', '.article-title h1', '.paper-title h1',
      'h1[itemprop="headline"]', 'h1[itemprop="name"]',
      '.citation_title', '.paper-title', '.article-title',
      // Generic heading patterns
      'article h1', 'main h1', '.content h1', '#content h1',
      // PDF viewer fallbacks
      '.page-title', '#title',
      // First h1 on the page as last resort before document.title
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Only use if it looks like a real title (not too short, not navigation)
        if (text && text.length > 5 && text.length < 500) {
          return text;
        }
      }
    }

    // Fallback to document title
    return this.document.title;
  }
  
  /**
   * Extract authors from document
   * Handles multiple author formats and sources with DOM fallbacks
   */
  protected extractAuthors(): string {
    // Get all citation authors (some pages have multiple citation_author tags)
    const citationAuthors: string[] = [];
    this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) citationAuthors.push(content);
    });

    // Get all DC creators
    const dcCreators: string[] = [];
    this.document.querySelectorAll('meta[name="DC.Creator.PersonalName"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) dcCreators.push(content);
    });

    // Individual author elements
    const dcCreator = this.getMetaContent('meta[name="DC.Creator.PersonalName"]') || this.getMetaContent('meta[name="dc.creator.personalname"]');
    const citationAuthor = this.getMetaContent('meta[name="citation_author"]');
    const ogAuthor = this.getMetaContent('meta[property="og:article:author"]') ||
                    this.getMetaContent('meta[name="author"]');

    // Set authors with priority from meta tags
    if (dcCreators.length > 0) {
      return dcCreators.join(', ');
    } else if (citationAuthors.length > 0) {
      return citationAuthors.join(', ');
    } else if (dcCreator) {
      return dcCreator;
    } else if (citationAuthor) {
      return citationAuthor;
    } else if (ogAuthor) {
      return ogAuthor;
    }

    // DOM-based fallback extraction
    const authorSelectors = [
      // Common academic page patterns
      '.authors a', '.author a', '.author-name a',
      '.authors', '.author', '.author-name', '.author-list',
      '[itemprop="author"]', '[rel="author"]',
      '.byline', '.by-line', '.article-author', '.paper-author',
      '.contributor', '.contributors',
      // arXiv-like patterns
      '.authors', '.authors-list',
      // IEEE/ACM patterns
      '.authors-info .author span', '.author-info',
      // Nature/Science patterns
      '.c-article-author-list', '.article-authors',
      // Generic patterns
      '.meta-authors', '#authors', '.author-block'
    ];

    for (const selector of authorSelectors) {
      const elements = this.document.querySelectorAll(selector);
      if (elements.length > 0) {
        const authors: string[] = [];
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 1 && text.length < 200) {
            // Clean up common prefixes
            const cleaned = text
              .replace(/^(by|authors?:?|written by)\s*/i, '')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleaned) {
              authors.push(cleaned);
            }
          }
        });
        if (authors.length > 0) {
          // If we got multiple elements, join them
          // If we got one element that looks like a comma-separated list, return as-is
          const result = authors.join(', ');
          if (result.length > 2) {
            return result;
          }
        }
      }
    }

    return '';
  }
  
  /**
   * Extract description/abstract from document with DOM fallbacks
   */
  protected extractDescription(): string {
    // Try meta tags first
    const metaDescription = (
      this.getMetaContent('meta[name="DC.Description"]') || this.getMetaContent('meta[name="dc.description"]') ||
      this.getMetaContent('meta[name="citation_abstract"]') ||
      this.getMetaContent('meta[property="og:description"]') ||
      this.getMetaContent('meta[name="description"]')
    );

    if (metaDescription && metaDescription.length > 50) {
      return metaDescription;
    }

    // DOM-based fallback extraction for abstracts
    const abstractSelectors = [
      // Common academic patterns
      '.abstract', '#abstract', '[id*="abstract"]', '[class*="abstract"]',
      '.Abstract', '#Abstract',
      // Specific patterns
      '.abstractSection', '.abstract-content', '.abstract-text',
      '.paper-abstract', '.article-abstract',
      // arXiv patterns
      'blockquote.abstract',
      // Summary patterns (some sites use "summary" instead of "abstract")
      '.summary', '#summary', '.article-summary',
      // IEEE/ACM patterns
      '.abstract-text', '.abstractInFull',
      // Nature/Science patterns
      '.c-article-section__content', '[data-component="article-abstract"]',
      // Schema.org patterns
      '[itemprop="description"]', '[itemprop="abstract"]'
    ];

    for (const selector of abstractSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        let text = element.textContent?.trim() || '';
        // Clean up the abstract
        text = text
          .replace(/^(abstract:?|summary:?)\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        // Only use if it looks like a real abstract (not too short)
        if (text.length > 100) {
          return text;
        }
      }
    }

    // If we have a short meta description, return it as fallback
    if (metaDescription) {
      return metaDescription;
    }

    return '';
  }
  
  /**
   * Extract publication date from document with DOM fallbacks
   */
  protected extractPublishedDate(): string {
    // Try meta tags first
    const metaDate = (
      this.getMetaContent('meta[name="DC.Date.issued"]') || this.getMetaContent('meta[name="dc.date.issued"]') ||
      this.getMetaContent('meta[name="dc.date"]') || this.getMetaContent('meta[name="dc.Date"]') ||
      this.getMetaContent('meta[name="DC.Date"]') ||
      this.getMetaContent('meta[name="citation_date"]') ||
      this.getMetaContent('meta[name="citation_publication_date"]') ||
      this.getMetaContent('meta[name="citation_online_date"]') ||
      this.getMetaContent('meta[property="article:published_time"]') ||
      this.getMetaContent('meta[property="article:modified_time"]')
    );

    if (metaDate) {
      return metaDate;
    }

    // DOM-based fallback extraction
    const dateSelectors = [
      // Common patterns
      '.date', '.pub-date', '.publication-date', '.published-date',
      '.article-date', '.paper-date', '.dateline',
      '[itemprop="datePublished"]', '[itemprop="dateCreated"]',
      'time[datetime]', 'time[pubdate]',
      // arXiv patterns
      '.dateline', '.submission-history',
      // Specific patterns
      '.meta-date', '.entry-date', '.post-date'
    ];

    for (const selector of dateSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        // Check for datetime attribute first (more reliable)
        const datetime = element.getAttribute('datetime') || element.getAttribute('content');
        if (datetime) {
          return datetime;
        }
        // Fall back to text content
        const text = element.textContent?.trim();
        if (text && this.looksLikeDate(text)) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Check if a string looks like a date
   */
  protected looksLikeDate(text: string): boolean {
    // Common date patterns
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/, // ISO format
      /\d{1,2}\/\d{1,2}\/\d{2,4}/, // US format
      /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Month name
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i, // Month name
      /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /\d{4}/ // Just a year
    ];
    return datePatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Extract DOI (Digital Object Identifier) from document with URL and DOM fallbacks
   */
  protected extractDoi(): string {
    // Try meta tags first
    const metaDoi = (
      this.getMetaContent('meta[name="DC.Identifier.DOI"]') || this.getMetaContent('meta[name="dc.identifier.doi"]') ||
      this.getMetaContent('meta[name="citation_doi"]') ||
      this.getMetaContent('meta[name="DOI"]') || this.getMetaContent('meta[name="doi"]')
    );

    if (metaDoi) {
      return metaDoi;
    }

    // Try to extract DOI from URL
    const doiFromUrl = this.extractDoiFromUrl(this.url);
    if (doiFromUrl) {
      return doiFromUrl;
    }

    // DOM-based fallback - look for DOI links or text
    const doiSelectors = [
      'a[href*="doi.org/10."]',
      'a[href*="/doi/10."]',
      '.doi', '#doi', '[class*="doi"]'
    ];

    for (const selector of doiSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        // Check href for DOI
        const href = element.getAttribute('href');
        if (href) {
          const doi = this.extractDoiFromUrl(href);
          if (doi) return doi;
        }
        // Check text content
        const text = element.textContent?.trim();
        if (text) {
          const doiMatch = text.match(/10\.\d{4,}\/[^\s]+/);
          if (doiMatch) {
            return doiMatch[0];
          }
        }
      }
    }

    return '';
  }

  /**
   * Extract DOI from a URL
   */
  protected extractDoiFromUrl(url: string): string {
    // Common DOI URL patterns
    const doiPatterns = [
      /doi\.org\/(10\.\d{4,}\/[^\s?#]+)/i,
      /\/doi\/(?:abs|full|pdf|epdf)?\/?((10\.\d{4,}\/[^\s?#]+))/i,
      /doi[=:](10\.\d{4,}\/[^\s&?#]+)/i
    ];

    for (const pattern of doiPatterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1] || match[2];
      }
    }

    return '';
  }
  
  /**
   * Extract journal name from document
   */
  protected extractJournalName(): string {
    return (
      this.getMetaContent('meta[name="DC.Source"]') || this.getMetaContent('meta[name="dc.source"]') ||
      this.getMetaContent('meta[name="citation_journal_title"]')
    );
  }
  
  /**
   * Extract keywords/tags from document
   */
  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="keywords"]') ||
                    this.getMetaContent('meta[name="DC.Subject"]') || this.getMetaContent('meta[name="dc.subject"]');
    
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim());
    }
    
    return [];
  }
  
  /**
   * Determine if the current URL is a PDF
   */
  public isPdf(): boolean {
    return isPdfUrl(this.url);
  }
  
  /**
   * Get the source type (PDF or URL)
   */
  public getSourceType(): SourceType {
    return this.isPdf() ? SOURCE_TYPES.PDF : SOURCE_TYPES.URL;
  }
  
  /**
   * Generate a paper ID for the current URL
   */
  public generatePaperId(): string {
    return generatePaperIdFromUrl(this.url);
  }
}

/**
 * Create a common metadata extractor for a document
 * Factory function for creating the default extractor
 */
export function createMetadataExtractor(document: Document): MetadataExtractor {
  return new MetadataExtractor(document);
}

/**
 * Extract common metadata from a document
 * Convenience function for quick extraction
 */
export function extractCommonMetadata(document: Document): ExtractedMetadata {
  return createMetadataExtractor(document).extract();
}

/**
 * Generate a paper ID from a URL
 * Creates a consistent hash-based identifier
 */
export function generatePaperIdFromUrl(url: string): string {
  // Use a basic hash function to create an ID from the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Create a positive hexadecimal string
  const positiveHash = Math.abs(hash).toString(16).toUpperCase();
  
  // Use the first 8 characters as the ID
  return positiveHash.substring(0, 8);
}

/**
 * Determine if a URL is a PDF
 */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}
