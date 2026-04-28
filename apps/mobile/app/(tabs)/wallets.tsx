import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, Stack, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type WalletType = 'cash' | 'debit' | 'credit_card' | 'savings' | 'investment' | 'crypto'

interface Wallet {
  id: string
  name: string
  type: WalletType
  currency: string
  opening_balance: number
  credit_limit: number | null
}

interface WalletWithBalance extends Wallet {
  balance: number | null
}

const WALLET_ICON: Record<WalletType, string> = {
  cash: '💵',
  debit: '🏦',
  credit_card: '💳',
  savings: '🏧',
  investment: '📈',
  crypto: '₿',
}

export default function WalletsScreen() {
  const { user } = useAuth()
  const [wallets, setWallets] = useState<WalletWithBalance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWallets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('id, name, type, currency, opening_balance, credit_limit')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to load wallets.')
        setLoading(false)
        return
      }

      const walletsWithBalances: WalletWithBalance[] = await Promise.all(
        (data ?? []).map(async (w) => {
          const { data: balanceData, error: balanceError } = await supabase.rpc(
            'get_wallet_balance',
            { p_wallet_id: w.id },
          )
          return {
            ...w,
            balance: balanceError ? null : (balanceData as number | null),
          }
        }),
      )

      setWallets(walletsWithBalances)
    } catch (err) {
      console.error('fetchWallets error:', err)
      Alert.alert('Error', 'Failed to load wallets. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      fetchWallets()
    }, [fetchWallets]),
  )

  function handleAddWallet() {
    router.push('/(wallets)/new')
  }

  function handleEditWallet(id: string) {
    router.push(`/(wallets)/${id}/edit`)
  }

  function formatBalance(balance: number | null, currency: string): string {
    if (balance === null) return '—'
    return `${balance.toFixed(2)} ${currency}`
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Wallets',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleAddWallet}
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
      ) : wallets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No wallets yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to add your first wallet</Text>
          <TouchableOpacity
            style={styles.addWalletButton}
            onPress={handleAddWallet}
            activeOpacity={0.8}
          >
            <Text style={styles.addWalletButtonText}>Add Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {wallets.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={styles.card}
              onPress={() => handleEditWallet(wallet.id)}
              activeOpacity={0.75}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.walletIcon}>{WALLET_ICON[wallet.type]}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletType}>{wallet.type.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              {wallet.type === 'credit_card' && wallet.credit_limit !== null ? (
                <View style={styles.creditDetails}>
                  <View style={styles.creditRow}>
                    <Text style={styles.creditLabel}>Owed</Text>
                    <Text style={[styles.creditValue, styles.owedValue]}>
                      {wallet.balance !== null
                        ? `${(wallet.credit_limit - wallet.balance).toFixed(2)} ${wallet.currency}`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.creditRow}>
                    <Text style={styles.creditLabel}>Limit</Text>
                    <Text style={styles.creditValue}>
                      {wallet.credit_limit.toFixed(2)} {wallet.currency}
                    </Text>
                  </View>
                  <View style={styles.creditRow}>
                    <Text style={styles.creditLabel}>Available</Text>
                    <Text style={[styles.creditValue, styles.availableValue]}>
                      {wallet.balance !== null
                        ? `${wallet.balance.toFixed(2)} ${wallet.currency}`
                        : '—'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.balance}>
                  {formatBalance(wallet.balance, wallet.currency)}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  addWalletButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addWalletButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  walletType: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  chevron: {
    fontSize: 22,
    color: '#9ca3af',
    fontWeight: '300',
  },
  balance: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  creditDetails: {
    gap: 4,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  creditValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  owedValue: {
    color: '#dc2626',
  },
  availableValue: {
    color: '#059669',
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
})
