export interface ReviewItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
  confidence: 'high' | 'low'
  isManuallyAdded?: boolean
}

export interface ParsedReceipt {
  store: string
  date: string
  items: ReviewItem[]
  total: number
  confidence: 'high' | 'low'
  discrepancy_warning?: boolean
}
