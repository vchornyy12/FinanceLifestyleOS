import type {
  ReceiptItemWithEnrichment,
  LegacyReceiptItem,
  ReceiptItemDisplay,
} from '@/lib/types/receiptItem'

export function toDisplay(
  item: ReceiptItemWithEnrichment | LegacyReceiptItem,
): ReceiptItemDisplay {
  const isEnriched = 'raw_name' in item

  const displayName = isEnriched
    ? (item.canonical_product_name ?? item.normalized_name ?? item.name)
    : item.name

  const rawName = isEnriched ? item.raw_name : item.name

  return {
    displayName,
    rawName,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category: item.category,
    needsReview: isEnriched ? item.needs_review : false,
    normalizationConfidence: isEnriched ? item.normalization_confidence : null,
  }
}
