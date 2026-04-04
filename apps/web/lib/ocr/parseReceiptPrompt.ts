export const RECEIPT_SYSTEM_PROMPT = `You are a Polish retail receipt parser. Extract every line item from the receipt image as structured JSON.

Return ONLY valid JSON matching this schema:
{
  "store": "string (store name, e.g. Biedronka, Żabka, Lidl)",
  "date": "string (ISO date YYYY-MM-DD, from receipt date)",
  "items": [
    {
      "name": "string (product name in Polish, as printed)",
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "category": "string (one of: Groceries, Beverages, Dairy, Bakery, Meat, Vegetables, Fruits, Snacks, Household, Pharmacy, Discount, Other)",
      "confidence": "high" | "low"
    }
  ],
  "total": number (receipt grand total),
  "confidence": "high" | "low"
}

Rules:
- Set confidence="low" for any item where price or name is unclear/partially obscured
- Set top-level confidence="low" if more than 20% of items are low-confidence
- Include loyalty card discounts as negative-value items with category "Discount"
- Ignore VAT summary blocks at the bottom
- Polish abbreviations: "szt." = pieces, "kg" = kg, "op." = package
- If the image is not a receipt or is completely illegible, return { "error": "NO_ITEMS_FOUND" }
`

export const buildReceiptUserMessage = (imageBase64: string, mimeType: string) => ({
  role: 'user' as const,
  content: [
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: imageBase64,
      },
    },
    { type: 'text' as const, text: 'Parse this receipt and return JSON only.' },
  ],
})
