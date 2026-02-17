// extension/source-integration/preprint-base.ts
// Shared base class for bioRxiv/medRxiv integrations (identical extraction logic)

import { BaseSourceIntegration } from './base-source';
import { MetadataExtractor } from './metadata-extractor';

/**
 * Shared metadata extractor for preprint servers (bioRxiv, medRxiv)
 * These sites use the same meta tag structure.
 */
export class PreprintMetadataExtractor extends MetadataExtractor {
  constructor(document: Document, private defaultVenue: string) {
    super(document);
  }

  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') ||
                      this.getMetaContent('meta[property="og:title"]') ||
                      this.getMetaContent('meta[name="DC.Title"]');
    return metaTitle || super.extractTitle();
  }

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

  protected extractDescription(): string {
    const metaDescription = this.getMetaContent('meta[name="citation_abstract"]') ||
                            this.getMetaContent('meta[name="description"]') ||
                            this.getMetaContent('meta[property="og:description"]');
    return metaDescription || super.extractDescription();
  }

  protected extractPublishedDate(): string {
    return this.getMetaContent('meta[name="citation_publication_date"]') ||
           this.getMetaContent('meta[name="citation_online_date"]') ||
           this.getMetaContent('meta[name="DC.Date"]') ||
           super.extractPublishedDate();
  }

  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') ||
           this.getMetaContent('meta[name="DC.Identifier"]') ||
           super.extractDoi();
  }

  protected extractJournalName(): string {
    return this.getMetaContent('meta[name="citation_journal_title"]') ||
           this.defaultVenue ||
           super.extractJournalName();
  }

  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="citation_keywords"]') ||
                    this.getMetaContent('meta[name="keywords"]');
    if (keywords) {
      return keywords.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
    }
    return super.extractTags();
  }
}

/** Build URL patterns for a preprint domain */
export function buildPreprintUrlPatterns(domain: string): RegExp[] {
  const d = domain.replace('.', '\\.');
  return [
    new RegExp(`${d}\\/content\\/(10\\.\\d+\\/[^\\s?#]+)`),
    new RegExp(`${d}\\/content\\/early\\/\\d+\\/\\d+\\/\\d+\\/(\\d+)`),
    new RegExp(`${d}\\/content\\/(10\\.\\d+\\/[^\\s?#]+)\\.full`),
    new RegExp(`${d}\\/content\\/(10\\.\\d+\\/[^\\s?#]+)\\.abstract`),
    new RegExp(`${d}\\/content\\/(10\\.\\d+\\/[^\\s?#]+)\\.pdf`),
    new RegExp(`${d}\\/cgi\\/content\\/full\\/(\\d+)`),
    new RegExp(`${d}\\/cgi\\/content\\/abstract\\/(\\d+)`),
    new RegExp(`${d}\\/content\\/`),
  ];
}

/**
 * Shared base class for preprint server integrations.
 * Subclasses set id, name, domain, and urlPatterns.
 */
export abstract class PreprintIntegration extends BaseSourceIntegration {
  abstract readonly domain: string;

  canHandleUrl(url: string): boolean {
    const d = this.domain.replace('.', '\\.');
    return new RegExp(`${d}\\/(content|cgi\\/content)\\/`).test(url);
  }

  extractPaperId(url: string): string | null {
    const d = this.domain.replace('.', '\\.');

    const doiMatch = url.match(new RegExp(`${d}\\/content\\/(10\\.\\d+\\/[^\\s?#.]+)`));
    if (doiMatch) {
      return doiMatch[1].replace(/v\d+$/, '');
    }

    const earlyMatch = url.match(/early\/\d+\/\d+\/\d+\/(\d+)/);
    if (earlyMatch) {
      return earlyMatch[1];
    }

    const cgiMatch = url.match(/cgi\/content\/(?:full|abstract)\/(\d+)/);
    if (cgiMatch) {
      return cgiMatch[1];
    }

    return null;
  }

  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new PreprintMetadataExtractor(document, this.name);
  }
}
