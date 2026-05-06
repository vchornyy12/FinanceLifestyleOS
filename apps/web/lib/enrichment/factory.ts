import type { ProductEnrichmentProvider } from './types'
import { OpenFoodFactsProvider } from './openFoodFacts'
import { GS1Provider } from './gs1'

type EnrichmentBackend = 'openfoodfacts' | 'gs1' | 'none'

class NullProvider implements ProductEnrichmentProvider {
  async lookup() { return null }
}

export function getEnrichmentProvider(
  backend: EnrichmentBackend = (process.env.NEXT_PUBLIC_ENRICHMENT_BACKEND as EnrichmentBackend | undefined) ?? 'openfoodfacts',
): ProductEnrichmentProvider {
  switch (backend) {
    case 'openfoodfacts': return new OpenFoodFactsProvider()
    case 'gs1':           return new GS1Provider()
    case 'none':          return new NullProvider()
  }
}
