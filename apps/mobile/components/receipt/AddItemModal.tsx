import { useState } from 'react'
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { ReviewItem } from '@/types/receipt'

interface Category {
  id: string
  name: string
}

interface Props {
  visible: boolean
  categories: Category[]
  onClose: () => void
  onAdd: (item: ReviewItem) => void
}

export default function AddItemModal({ visible, categories, onClose, onAdd }: Props) {
  const [name, setName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setUnitPrice('')
    setQuantity('1')
    setCategory('')
    setError(null)
    setShowCategoryPicker(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleAdd = () => {
    const parsedPrice = parseFloat(unitPrice)
    const parsedQty = parseFloat(quantity)

    if (!name.trim()) {
      setError('Item name is required')
      return
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Enter a valid price')
      return
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Enter a valid quantity')
      return
    }

    const newItem: ReviewItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      quantity: parsedQty,
      unit_price: parsedPrice,
      total_price: Math.round(parsedPrice * parsedQty * 100) / 100,
      category,
      confidence: 'high',
      isManuallyAdded: true,
    }

    onAdd(newItem)
    resetForm()
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-blue-600">Cancel</Text>
          </TouchableOpacity>
          <Text className="font-semibold text-zinc-900 dark:text-white">Add Item</Text>
          <TouchableOpacity onPress={handleAdd}>
            <Text className="text-blue-600 font-semibold">Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
          {error && (
            <Text className="text-red-500 text-sm mb-3">{error}</Text>
          )}

          <Text className="text-xs text-zinc-500 uppercase mb-1">Item Name</Text>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); setError(null) }}
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 mb-4 text-zinc-900 dark:text-white"
            placeholder="e.g. Bread"
            placeholderTextColor="#9ca3af"
            autoFocus
          />

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-xs text-zinc-500 uppercase mb-1">Unit Price (PLN)</Text>
              <TextInput
                value={unitPrice}
                onChangeText={(v) => { setUnitPrice(v); setError(null) }}
                keyboardType="decimal-pad"
                className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-white"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-zinc-500 uppercase mb-1">Quantity</Text>
              <TextInput
                value={quantity}
                onChangeText={(v) => { setQuantity(v); setError(null) }}
                keyboardType="decimal-pad"
                className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-white"
                placeholder="1"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <Text className="text-xs text-zinc-500 uppercase mb-1">Category (optional)</Text>
          <TouchableOpacity
            onPress={() => setShowCategoryPicker((v) => !v)}
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 mb-2"
          >
            <Text className={category ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}>
              {category || 'Select category…'}
            </Text>
          </TouchableOpacity>

          {showCategoryPicker && (
            <View className="border border-zinc-200 dark:border-zinc-700 rounded-lg mb-4 overflow-hidden">
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { setCategory(cat.name); setShowCategoryPicker(false) }}
                  className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800"
                >
                  <Text className="text-zinc-800 dark:text-zinc-200">{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}
