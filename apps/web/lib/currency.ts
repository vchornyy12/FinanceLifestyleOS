interface FrankfurterResponse {
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Fetch latest EUR-base exchange rates from frankfurter.app.
 * Next.js caches the fetch response for 1 hour (ISR-style revalidation).
 * Falls back to an empty map on network failure so callers can degrade gracefully.
 */
export async function fetchRatesFromEUR(): Promise<{ rates: Record<string, number>; date: string }> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`frankfurter responded ${res.status}`)
    const data: FrankfurterResponse = await res.json()
    return { rates: { ...data.rates, EUR: 1 }, date: data.date }
  } catch {
    return { rates: {}, date: '' }
  }
}

/**
 * Convert `amount` in `currency` to PLN using EUR-base rates.
 * Returns the original amount unchanged if the currency is unknown
 * (e.g. rates fetch failed).
 */
export function convertToPLN(
  amount: number,
  currency: string,
  ratesFromEUR: Record<string, number>,
): number {
  if (currency === 'PLN') return amount
  const plnPerEur = ratesFromEUR['PLN']
  const unitPerEur = ratesFromEUR[currency]
  if (!plnPerEur || !unitPerEur) return amount
  return amount * (plnPerEur / unitPerEur)
}
