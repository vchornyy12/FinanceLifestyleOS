import { normalizePolish } from './polish'
import { tokenize } from './tokenize'
import { expandAbbreviation } from './abbreviations'
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NormalizationResult {
  rawName: string
  normalizedName: string
  canonical_product_name: string | null
  attributes: {
    size_value: number | null
    size_unit: string | null
    flavor: string | null
    variant: string | null
  }
  fingerprint: string
  confidence: number
  source: 'ocr' | 'rule' | 'dictionary' | 'ai' | 'user'
  needs_review: boolean
}

function buildFingerprint(normalizedName: string, retailer?: string): string {
  const input = `${retailer ?? ''}:${normalizedName.toUpperCase()}`
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16)
}

export async function normalizeReceiptItem(
  raw: string,
  userId: string,
  retailer?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: SupabaseClient<any>,
): Promise<NormalizationResult> {
  const { tokens, attributes } = tokenize(raw)

  const sizeTokenPattern = /^\d+(?:[.,]\d+)?$|^(g|kg|ml|l|szt|pcs|cl|mg|dkg)$/i
  const meaningfulTokens = tokens.filter((t) => !sizeTokenPattern.test(t))

  let normalizedName = normalizePolish(raw)
  let canonical_product_name: string | null = null
  let confidence = 0.5
  let source: NormalizationResult['source'] = 'rule'

  // Try the full raw string first (exact dictionary match)
  const fullMatch = await expandAbbreviation(raw.toUpperCase(), userId, retailer, supabaseClient)
  if (fullMatch) {
    normalizedName = fullMatch.normalized
    canonical_product_name = fullMatch.canonical_product_name
    confidence = fullMatch.confidence
    source = fullMatch.source === 'user' ? 'user' : 'dictionary'
  } else if (meaningfulTokens.length > 0) {
    // Try token-by-token expansion and join results
    const expanded: string[] = []
    let tokenConfidence = 0.5
    let tokenSource: NormalizationResult['source'] = 'rule'

    for (const token of meaningfulTokens) {
      const match = await expandAbbreviation(token, userId, retailer, supabaseClient)
      if (match) {
        expanded.push(match.normalized)
        tokenConfidence = Math.max(tokenConfidence, match.confidence * 0.85)
        tokenSource = match.source === 'user' ? 'user' : 'dictionary'
      } else {
        expanded.push(normalizePolish(token).toLowerCase())
      }
    }

    normalizedName = expanded.join(' ')
    confidence = tokenConfidence
    source = tokenSource
  }

  const fingerprint = buildFingerprint(normalizedName, retailer)

  return {
    rawName: raw,
    normalizedName,
    canonical_product_name,
    attributes,
    fingerprint,
    confidence,
    source,
    needs_review: confidence < 0.7,
  }
}
