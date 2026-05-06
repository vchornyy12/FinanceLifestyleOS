import type { ProductEnrichmentProvider } from './types'

// TODO: implement when GS1 Polska API credentials are available.
// Requires: NEXT_PUBLIC_GS1_API_KEY + GS1 API endpoint.
export class GS1Provider implements ProductEnrichmentProvider {
  async lookup(_options: { barcode?: string; name?: string }) {
    return null
  }
}
