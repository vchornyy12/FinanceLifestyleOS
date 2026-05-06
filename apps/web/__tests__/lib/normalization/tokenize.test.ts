import { describe, it, expect } from 'vitest'
import { tokenize } from '@/lib/normalization/tokenize'

describe('tokenize', () => {
  it('extracts grams', () => {
    const { attributes } = tokenize('SER ZOLTY 200g')
    expect(attributes.size_value).toBe(200)
    expect(attributes.size_unit).toBe('g')
  })

  it('extracts ml', () => {
    const { attributes } = tokenize('MLEKO 500ml')
    expect(attributes.size_value).toBe(500)
    expect(attributes.size_unit).toBe('ml')
  })

  it('extracts kg with decimal comma', () => {
    const { attributes } = tokenize('KURCZAK 1,5kg')
    expect(attributes.size_value).toBe(1.5)
    expect(attributes.size_unit).toBe('kg')
  })

  it('detects truskawkowy flavor', () => {
    const { attributes } = tokenize('JOG TRUSK 150g')
    expect(attributes.flavor).toBe('truskawkowy')
  })

  it('detects malinowy flavor', () => {
    const { attributes } = tokenize('SEREK MALIN')
    expect(attributes.flavor).toBe('malinowy')
  })

  it('detects light variant', () => {
    const { attributes } = tokenize('MLEKO LIGHT')
    expect(attributes.variant).toBe('light')
  })

  it('detects UHT variant', () => {
    const { attributes } = tokenize('MLEKO UHT 1L')
    expect(attributes.variant).toBe('UHT')
  })

  it('returns null attributes when none present', () => {
    const { attributes } = tokenize('CHLEB')
    expect(attributes.size_value).toBeNull()
    expect(attributes.size_unit).toBeNull()
    expect(attributes.flavor).toBeNull()
    expect(attributes.variant).toBeNull()
  })

  it('splits tokens on spaces', () => {
    const { tokens } = tokenize('JOG TRUSK 150g')
    expect(tokens).toContain('JOG')
    expect(tokens).toContain('TRUSK')
  })
})
