const DIACRITIC_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n',
  ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N',
  Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
}

export function stripDiacritics(text: string): string {
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch)
}

export function caseFold(text: string): string {
  return text.toUpperCase()
}

export function normalizePolish(text: string): string {
  return caseFold(stripDiacritics(text))
}
