import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert, Modal, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { ParsedReceipt, ReviewItem } from '@/types/receipt'
import ReceiptItemRow from '@/components/receipt/ReceiptItem'
import AddItemModal from '@/components/receipt/AddItemModal'
import { saveReceipt } from '@/lib/actions/saveReceipt'
import { useAuth } from '@/context/AuthContext'
import { useCategories } from '@/hooks/useCategories'
import { parseOcrReceipt } from '@/lib/ocr/receiptSchema'
import { supabase } from '@/lib/supabase'

interface WalletOption {
  id: string
  name: string
  type: string
}

const WALLET_ICONS: Record<string, string> = {
  cash: '💵', debit: '🏦', credit_card: '💳', savings: '🏧', investment: '📈', crypto: '₿',
}

function parseReceiptParam(raw: string | string[] | undefined): ParsedReceipt | null {
  const str = Array.isArray(raw) ? raw[0] : raw
  if (!str) return null
  try {
    return parseOcrReceipt(JSON.parse(str))
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

  // Wallet state
  const [wallets, setWallets] = useState<WalletOption[]>([])
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletModalVisible, setWalletModalVisible] = useState(false)

  useEffect(() => {
    supabase
      .from('wallets')
      .select('id, name, type')
      .order('created_at')
      .then(({ data }) => setWallets(data ?? []))
  }, [])

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
      await saveReceipt(items, parsed, resolvedPath, categories, walletId)
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

      {/* Footer: wallet picker + total + save button */}
      <View className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
        {/* Wallet picker */}
        <Text className="text-xs font-semibold text-zinc-500 mb-1">Wallet (optional)</Text>
        <TouchableOpacity
          onPress={() => setWalletModalVisible(true)}
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-white dark:bg-zinc-900"
        >
          <Text className="text-zinc-800 dark:text-zinc-100">
            {walletId
              ? (() => {
                  const w = wallets.find((x) => x.id === walletId)
                  return w ? `${WALLET_ICONS[w.type] ?? '🏦'} ${w.name}` : 'None'
                })()
              : 'None'}
          </Text>
        </TouchableOpacity>

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

      {/* Wallet Modal */}
      <Modal
        visible={walletModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View style={reviewStyles.modalOverlay}>
          <View style={reviewStyles.modalContent}>
            <View style={reviewStyles.modalHeader}>
              <Text style={reviewStyles.modalTitle}>Select Wallet</Text>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)}>
                <Text style={reviewStyles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[reviewStyles.walletItem, walletId === null ? reviewStyles.walletItemSelected : null]}
              onPress={() => { setWalletId(null); setWalletModalVisible(false) }}
            >
              <Text style={[reviewStyles.walletItemText, walletId === null ? reviewStyles.walletItemTextSelected : null]}>
                None
              </Text>
            </TouchableOpacity>

            <FlatList
              data={wallets}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[reviewStyles.walletItem, walletId === item.id ? reviewStyles.walletItemSelected : null]}
                  onPress={() => { setWalletId(item.id); setWalletModalVisible(false) }}
                >
                  <Text style={[reviewStyles.walletItemText, walletId === item.id ? reviewStyles.walletItemTextSelected : null]}>
                    {WALLET_ICONS[item.type] ?? '🏦'} {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={reviewStyles.emptyText}>No wallets found</Text>}
            />
          </View>
        </View>
      </Modal>

      <AddItemModal
        visible={showAddModal}
        categories={categories}
        onClose={() => setShowAddModal(false)}
        onAdd={(item) => setItems((prev) => [...prev, item])}
      />
    </View>
  )
}

const reviewStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  walletItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  walletItemSelected: {
    backgroundColor: '#eff6ff',
  },
  walletItemText: {
    fontSize: 16,
    color: '#111827',
  },
  walletItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#6b7280',
  },
})
