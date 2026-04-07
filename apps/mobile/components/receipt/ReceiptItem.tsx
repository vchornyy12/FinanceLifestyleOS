import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { ReviewItem } from '@/types/receipt'

interface Category {
  id: string
  name: string
}

interface Props {
  item: ReviewItem
  categories: Category[]
  onUpdate: (updates: Partial<ReviewItem>) => void
  onDelete: () => void
}

export default function ReceiptItemRow({ item, categories, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  // Local draft state — never committed until handleConfirm
  const [nameDraft, setNameDraft] = useState(item.name)
  const [unitPriceDraft, setUnitPriceDraft] = useState(String(item.unit_price))
  const [quantityDraft, setQuantityDraft] = useState(String(item.quantity))
  const [categoryDraft, setCategoryDraft] = useState(item.category)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // Reset drafts if item identity changes (e.g. external update from parent)
  useEffect(() => {
    setNameDraft(item.name)
    setUnitPriceDraft(String(item.unit_price))
    setQuantityDraft(String(item.quantity))
    setCategoryDraft(item.category)
    setEditing(false)
    setShowCategoryPicker(false)
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = () => {
    // Snapshot current item state into drafts when opening edit
    setNameDraft(item.name)
    setUnitPriceDraft(String(item.unit_price))
    setQuantityDraft(String(item.quantity))
    setCategoryDraft(item.category)
    setShowCategoryPicker(false)
    setEditing(true)
  }

  const handleConfirm = () => {
    const parsedPrice = parseFloat(unitPriceDraft)
    const parsedQty = parseFloat(quantityDraft)
    if (isNaN(parsedPrice) || parsedPrice <= 0) return
    if (isNaN(parsedQty) || parsedQty <= 0) return
    onUpdate({
      name: nameDraft.trim() || item.name,
      unit_price: parsedPrice,
      quantity: parsedQty,
      category: categoryDraft,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    // Discard all drafts — no changes committed to parent
    setEditing(false)
    setShowCategoryPicker(false)
  }

  if (editing) {
    return (
      <View className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-blue-50 dark:bg-zinc-900">
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 mb-2 text-zinc-900 dark:text-white"
          placeholder="Item name"
          placeholderTextColor="#9ca3af"
        />
        <View className="flex-row gap-2 mb-2">
          <View className="flex-1">
            <Text className="text-xs text-zinc-500 mb-1">Unit price</Text>
            <TextInput
              value={unitPriceDraft}
              onChangeText={setUnitPriceDraft}
              keyboardType="decimal-pad"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-zinc-900 dark:text-white"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-zinc-500 mb-1">Quantity</Text>
            <TextInput
              value={quantityDraft}
              onChangeText={setQuantityDraft}
              keyboardType="decimal-pad"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-zinc-900 dark:text-white"
              placeholder="1"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Category picker — updates draft only, never parent */}
        <TouchableOpacity
          onPress={() => setShowCategoryPicker((v) => !v)}
          className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 mb-2"
        >
          <Text className="text-zinc-700 dark:text-zinc-300">{categoryDraft || 'Select category'}</Text>
        </TouchableOpacity>
        {showCategoryPicker && (
          <View
            className="border border-zinc-200 dark:border-zinc-700 rounded mb-2"
            style={{ maxHeight: 140 }}
          >
            <ScrollView nestedScrollEnabled>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setCategoryDraft(cat.name)
                    setShowCategoryPicker(false)
                  }}
                  className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800"
                >
                  <Text className="text-zinc-800 dark:text-zinc-200">{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleConfirm}
            className="flex-1 bg-blue-600 rounded py-1.5 items-center"
          >
            <Text className="text-white text-sm font-medium">Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCancel}
            className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded py-1.5 items-center"
          >
            <Text className="text-zinc-700 dark:text-zinc-200 text-sm">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <TouchableOpacity
      onPress={openEdit}
      className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-row items-center"
    >
      <View className="flex-1 mr-3">
        <View className="flex-row items-center gap-1">
          {item.confidence === 'low' && (
            <Text className="text-amber-500 text-xs">⚠️</Text>
          )}
          <Text className="text-zinc-900 dark:text-white" numberOfLines={1}>{item.name}</Text>
        </View>
        <Text className="text-xs text-zinc-500 mt-0.5">
          {item.quantity} × {item.unit_price.toFixed(2)} PLN
          {item.category ? ` · ${item.category}` : ''}
        </Text>
      </View>
      <Text className="text-zinc-900 dark:text-white font-medium mr-3">
        {item.total_price.toFixed(2)} PLN
      </Text>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text className="text-red-500 text-lg leading-none">×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}
