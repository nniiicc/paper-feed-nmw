// extension/source-integration/misc/index.ts
/*
 * Catch-all for registering with URL pattern only
 * This integration handles papers from various academic sources not covered by specific integrations
 */
import { BaseSourceIntegration } from '../base-source';

export class MiscIntegration extends BaseSourceIntegration {
  readonly id = 'url-misc';
  readonly name = 'misc tracked url';

  // URL patterns for link detection - these enable the annotation icon on matching links
  readonly urlPatterns = [
    // ScienceDirect
    /sciencedirect\.com\/science\/article\//,
    // PhilPapers
    /philpapers\.org\/rec\//,
    // NeurIPS proceedings
    /proceedings\.neurips\.cc\/paper_files\/paper\//,
    /papers\.nips\.cc\/paper_files\/paper\//,
    // Sage Journals
    /journals\.sagepub\.com\/doi\//,
    // Springer Link
    /link\.springer\.com\/article\//,
    // Science.org
    /science\.org\/doi\//,
    // APS Journals
    /journals\.aps\.org\/\w+\/abstract\//,
    // Wiley
    /onlinelibrary\.wiley\.com\/doi\//,
    /physoc\.onlinelibrary\.wiley\.com\/doi\//,
    // Cell Press
    /cell\.com\/.*\/fulltext\//,
    // ResearchGate
    /researchgate\.net\/publication\//,
    // APA PsycNET
    /psycnet\.apa\.org\/record\//,
    // bioRxiv/medRxiv
    /biorxiv\.org\/content\//,
    /medrxiv\.org\/content\//,
    // OSF Preprints
    /osf\.io\/preprints\//,
    // Frontiers
    /frontiersin\.org\/journals?\//,
    /frontiersin\.org\/articles?\//,
    // JSTOR
    /jstor\.org\/stable\//,
    // PMLR (Proceedings of Machine Learning Research)
    /proceedings\.mlr\.press\//,
    // PLOS
    /journals\.plos\.org\/\w+\/article/,
    // IEEE Xplore
    /ieeexplore\.ieee\.org\/document\//,
    /ieeexplore\.ieee\.org\/abstract\/document\//,
    // Royal Society
    /royalsocietypublishing\.org\/doi\//,
    // PhilArchive
    /philarchive\.org\/archive\//,
    // Taylor & Francis
    /tandfonline\.com\/doi\//,
    // IOP Science
    /iopscience\.iop\.org\/article\//,
    // Oxford Academic
    /academic\.oup\.com\/\w+\/article/,
    // eLife
    /elifesciences\.org\/articles\//,
    // eScholarship
    /escholarship\.org\/content\//,
    // PubMed Central
    /pmc\.ncbi\.nlm\.nih\.gov\/articles\//,
    /ncbi\.nlm\.nih\.gov\/pmc\/articles\//,
    // PubMed
    /pubmed\.ncbi\.nlm\.nih\.gov\/\d+/,
    // CVF Open Access
    /openaccess\.thecvf\.com\/content/,
    // Zenodo
    /zenodo\.org\/records?\//,
    // ASM Journals
    /journals\.asm\.org\/doi\//,
    // BMJ
    /bmj\.com\/content\//,
    // ACL Anthology
    /aclanthology\.org\/[A-Z0-9.-]+\//,
    // AMS Journals
    /journals\.ametsoc\.org\/view\/journals\//,
    // Substack (for academic newsletters)
    /substack\.com\/p\//,
    // CiteSeerX
    /citeseerx\.ist\.psu\.edu\//,
    // Hugging Face Papers
    /huggingface\.co\/papers\//,
    // Papers With Code
    /paperswithcode\.com\/paper\//,
    // Google Scholar direct links
    /scholar\.google\.com\/scholar\?.*cluster=/,
    // SSRN
    /papers\.ssrn\.com\/sol3\/papers\.cfm/,
    /ssrn\.com\/abstract=/,
    // Cambridge Core
    /cambridge\.org\/core\/journals\/.*\/article\//,
    // Annual Reviews
    /annualreviews\.org\/doi\//,
    // Generic DOI patterns
    /\/doi\/(?:abs|full|pdf|epdf)?\/?10\.\d+\//,
    // Generic PDF patterns (academic contexts)
    /\.pdf(?:\?|$)/,
  ];

  // Content script matches - used for canHandleUrl checks
  readonly contentScriptMatches = [
    "sciencedirect.com/science/article/",
    "philpapers.org/rec/",
    "proceedings.neurips.cc/paper_files/paper/",
    "journals.sagepub.com/doi/",
    "link.springer.com/article/",
    ".science.org/doi/",
    "journals.aps.org/prx/abstract/",
    "onlinelibrary.wiley.com/doi/",
    "cell.com/trends/cognitive-sciences/fulltext/",
    "researchgate.net/publication/",
    "psycnet.apa.org/record/",
    "biorxiv.org/content/",
    "medrxiv.org/content/",
    "osf.io/preprints/",
    "frontiersin.org/journals/",
    "frontiersin.org/articles/",
    "jstor.org/stable/",
    "proceedings.mlr.press/",
    "journals.plos.org/plosone/article",
    "ieeexplore.ieee.org/document/",
    "royalsocietypublishing.org/doi/",
    "papers.nips.cc/paper_files/paper/",
    "philarchive.org/archive/",
    "tandfonline.com/doi/",
    "iopscience.iop.org/article/",
    "academic.oup.com/brain/article/",
    "elifesciences.org/articles/",
    "escholarship.org/content/",
    "pmc.ncbi.nlm.nih.gov/articles/",
    "ncbi.nlm.nih.gov/pmc/articles/",
    "pubmed.ncbi.nlm.nih.gov/",
    "openaccess.thecvf.com/content/",
    "zenodo.org/records/",
    "journals.asm.org/doi/full/",
    "physoc.onlinelibrary.wiley.com/doi/full/",
    "storage.courtlistener.com/recap/",
    "bmj.com/content/",
    "ntsb.gov/investigations/pages",
    "ntsb.gov/investigations/AccidentReports",
    "aclanthology.org/",
    "journals.ametsoc.org/view/journals/",
    "huggingface.co/papers/",
    "paperswithcode.com/paper/",
    "papers.ssrn.com/",
    "ssrn.com/abstract=",
    "cambridge.org/core/journals/",
    "annualreviews.org/doi/",
    "substack.com/p/",
    "citeseerx.",
    "/doi/",
    "/pdf/",
  ];

  canHandleUrl(url: string): boolean {
    // First check urlPatterns (regex)
    if (this.urlPatterns.some(pattern => pattern.test(url))) {
      return true;
    }
    // Then check contentScriptMatches (substring)
    return this.contentScriptMatches.some(pattern => url.includes(pattern));
  }
}

export const miscIntegration = new MiscIntegration();
