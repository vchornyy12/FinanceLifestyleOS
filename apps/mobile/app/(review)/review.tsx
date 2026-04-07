import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { ParsedReceipt, ReviewItem } from '@/types/receipt'
import ReceiptItemRow from '@/components/receipt/ReceiptItem'
import AddItemModal from '@/components/receipt/AddItemModal'
import { saveReceipt } from '@/lib/actions/saveReceipt'
import { useAuth } from '@/context/AuthContext'
import { useCategories } from '@/hooks/useCategories'

function isValidParsedReceipt(v: unknown): v is ParsedReceipt {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.store === 'string' &&
    typeof r.date === 'string' &&
    typeof r.total === 'number' &&
    Array.isArray(r.items)
  )
}

function parseReceiptParam(raw: string | string[] | undefined): ParsedReceipt | null {
  const str = Array.isArray(raw) ? raw[0] : raw
  if (!str) return null
  try {
    const parsed: unknown = JSON.parse(str)
    return isValidParsedReceipt(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Round to 2 decimal places to avoid IEEE 754 drift in financial totals. */
function roundAmount(n: number): number {
  return Math.round(n * 100) / 100
}

export default function ReviewScreen() {
  const { receiptJson, storagePath } = useLocalSearchParams<{ receiptJson: string; storagePath: string }>()
  const { categories } = useCategories()
  const { user } = useAuth()

  const parsed = parseReceiptParam(receiptJson)
  const resolvedPath = Array.isArray(storagePath) ? storagePath[0] : (storagePath ?? '')

  const [items, setItems] = useState<ReviewItem[]>(() => {
    if (!parsed) return []
    return [...parsed.items].sort((a, b) => {
      if (a.confidence === 'low' && b.confidence !== 'low') return -1
      if (a.confidence !== 'low' && b.confidence === 'low') return 1
      return 0
    })
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const total = roundAmount(items.reduce((sum, item) => sum + item.total_price, 0))

  if (!parsed) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950 px-8">
        <Text className="text-red-500 text-center">Receipt data is missing. Please try again.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const handleUpdate = (id: string, updates: Partial<ReviewItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, ...updates }
        if (updates.unit_price !== undefined || updates.quantity !== undefined) {
          updated.total_price = roundAmount(updated.unit_price * updated.quantity)
        }
        return updated
      })
    )
  }

  const handleDelete = (id: string) => {
    Alert.alert('Delete Item', 'Remove this item from the receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setItems((prev) => prev.filter((item) => item.id !== id)),
      },
    ])
  }

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Session expired', 'Please sign in again to save.')
      return
    }
    setSaving(true)
    try {
      await saveReceipt(items, parsed, resolvedPath, user.id, categories)
      Alert.alert('Saved', 'Receipt saved!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ])
    } catch {
      Alert.alert('Error', 'Failed to save receipt. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      {/* Header: store name + date */}
      <View className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Text className="text-lg font-semibold dark:text-white">{parsed.store}</Text>
        <Text className="text-sm text-zinc-500">{parsed.date}</Text>
        {parsed.discrepancy_warning && (
          <Text className="text-amber-500 text-xs mt-1">
            ⚠️ Totals may not match — review carefully
          </Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReceiptItemRow
            item={item}
            categories={categories}
            onUpdate={(updates) => handleUpdate(item.id, updates)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListFooterComponent={
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="mx-4 my-2 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg items-center"
          >
            <Text className="text-zinc-500">+ Add item manually</Text>
          </TouchableOpacity>
        }
      />

      {/* Footer: total + save button */}
      <View className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
        <View className="flex-row justify-between mb-3">
          <Text className="font-semibold dark:text-white">Total</Text>
          <Text className="font-semibold dark:text-white">{total.toFixed(2)} PLN</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || items.length === 0}
          style={{ opacity: saving || items.length === 0 ? 0.5 : 1 }}
          className="bg-blue-600 rounded-lg py-3 items-center"
        >
          <Text className="text-white font-semibold">{saving ? 'Saving…' : 'Save Receipt'}</Text>
        </TouchableOpacity>
      </View>

      <AddItemModal
        visible={showAddModal}
        categories={categories}
        onClose={() => setShowAddModal(false)}
        onAdd={(item) => setItems((prev) => [...prev, item])}
      />
    </View>
  )
}
