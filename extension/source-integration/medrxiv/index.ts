// extension/source-integration/medrxiv/index.ts
// medRxiv integration using shared preprint base class

import { PreprintIntegration, buildPreprintUrlPatterns } from '../preprint-base';

export class MedRxivIntegration extends PreprintIntegration {
  readonly id = 'medrxiv';
  readonly name = 'medRxiv';
  readonly domain = 'medrxiv.org';
  readonly urlPatterns = buildPreprintUrlPatterns('medrxiv.org');
}

export const medRxivIntegration = new MedRxivIntegration();
