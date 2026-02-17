// extension/source-integration/biorxiv/index.ts
// bioRxiv integration using shared preprint base class

import { PreprintIntegration, buildPreprintUrlPatterns } from '../preprint-base';

export class BioRxivIntegration extends PreprintIntegration {
  readonly id = 'biorxiv';
  readonly name = 'bioRxiv';
  readonly domain = 'biorxiv.org';
  readonly urlPatterns = buildPreprintUrlPatterns('biorxiv.org');
}

export const bioRxivIntegration = new BioRxivIntegration();
