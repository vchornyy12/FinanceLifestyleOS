import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { useTransactions, TransactionRow } from '@/hooks/useTransactions'
import type { TransactionType } from '@/types/database'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function typePresentation(type: TransactionType) {
  if (type === 'income') {
    return {
      symbol: '+',
      arrow: '↑',
      label: 'Income',
      amountColor: '#059669',
      badgeBg: '#ecfdf5',
      badgeFg: '#047857',
    }
  }
  if (type === 'transfer') {
    return {
      symbol: '',
      arrow: '↔',
      label: 'Transfer',
      amountColor: '#374151',
      badgeBg: '#f3f4f6',
      badgeFg: '#374151',
    }
  }
  return {
    symbol: '−',
    arrow: '↓',
    label: 'Expense',
    amountColor: '#dc2626',
    badgeBg: '#fef2f2',
    badgeFg: '#b91c1c',
  }
}

function TransactionItem({ item }: { item: TransactionRow }) {
  const pres = typePresentation(item.type)
  const description =
    item.type === 'transfer'
      ? `${item.from_account ?? '?'} → ${item.to_account ?? '?'}`
      : item.merchant
  const formattedAmount = `${pres.symbol}${item.amount.toFixed(2)} PLN`

  return (
    <View style={styles.item}>
      <View style={styles.itemLeft}>
        <View style={styles.itemRow}>
          <View style={[styles.badge, { backgroundColor: pres.badgeBg }]}>
            <Text style={[styles.badgeText, { color: pres.badgeFg }]}>
              {pres.arrow} {pres.label}
            </Text>
          </View>
        </View>
        <Text style={styles.itemMerchant} numberOfLines={1}>
          {description}
        </Text>
        <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
      </View>
      <Text style={[styles.itemAmount, { color: pres.amountColor }]}>
        {formattedAmount}
      </Text>
    </View>
  )
}

export default function TransactionsScreen() {
  const { user } = useAuth()
  const { transactions, loading } = useTransactions(user?.id ?? '')

  function handleAddPress() {
    router.push('/transactions/new')
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Transactions',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleAddPress}
              style={styles.addButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to add your first transaction</Text>
          <TouchableOpacity style={styles.fabFallback} onPress={handleAddPress} activeOpacity={0.8}>
            <Text style={styles.fabFallbackText}>Add Transaction</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TransactionItem item={item} />}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <TouchableOpacity style={styles.fab} onPress={handleAddPress} activeOpacity={0.85}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemMerchant: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 16,
  },
  addButton: {
    marginRight: 4,
  },
  addButtonText: {
    fontSize: 28,
    color: '#3b82f6',
    fontWeight: '400',
    lineHeight: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 34,
    marginTop: -2,
  },
  fabFallback: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  fabFallbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
