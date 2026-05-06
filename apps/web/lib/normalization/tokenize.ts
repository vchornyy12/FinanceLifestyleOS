export interface TokenizeResult {
  tokens: string[]
  attributes: {
    size_value: number | null
    size_unit: string | null
    flavor: string | null
    variant: string | null
  }
}

const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|szt|pcs|cl|mg|dkg)/i

const FLAVOR_KEYWORDS: Record<string, string> = {
  TRUSK: 'truskawkowy',
  MALIN: 'malinowy',
  BORÓW: 'borówkowy',
  BOROW: 'borówkowy',
  BANAN: 'bananowy',
  WANIL: 'waniliowy',
  CZEK: 'czekoladowy',
  CHOC: 'czekoladowy',
  CYTRY: 'cytrynowy',
  MANGO: 'mango',
  BRZOS: 'brzoskwiniowy',
}

const VARIANT_KEYWORDS: Record<string, string> = {
  LIGHT: 'light',
  BIO: 'bio',
  UHT: 'UHT',
  EKOL: 'ekologiczny',
  NATUR: 'naturalny',
  ORIGI: 'oryginalny',
  SLIM: 'slim',
}

export function tokenize(raw: string): TokenizeResult {
  const sizeMatch = raw.match(SIZE_PATTERN)
  const size_value = sizeMatch ? parseFloat(sizeMatch[1].replace(',', '.')) : null
  const size_unit = sizeMatch ? sizeMatch[2].toLowerCase() : null

  const upper = raw.toUpperCase()
  const tokens = raw
    .replace(SIZE_PATTERN, ' ')
    .split(/[\s,./\\|]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  let flavor: string | null = null
  for (const [key, val] of Object.entries(FLAVOR_KEYWORDS)) {
    if (upper.includes(key)) { flavor = val; break }
  }

  let variant: string | null = null
  for (const [key, val] of Object.entries(VARIANT_KEYWORDS)) {
    if (upper.includes(key)) { variant = val; break }
  }

  return { tokens, attributes: { size_value, size_unit, flavor, variant } }
}
