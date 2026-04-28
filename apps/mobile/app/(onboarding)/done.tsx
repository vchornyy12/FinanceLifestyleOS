import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'

type WalletType = 'cash' | 'debit' | 'credit_card' | 'savings' | 'investment' | 'crypto'

interface WalletPayload {
  name: string
  type: WalletType
  currency: string
  opening_balance: number
  credit_limit?: number
}

const TYPE_LABELS: Record<WalletType, string> = {
  cash: '💵 Cash',
  debit: '🏦 Debit',
  credit_card: '💳 Credit Card',
  savings: '🏧 Savings',
  investment: '📈 Investment',
  crypto: '₿ Crypto',
}

export default function OnboardingDoneScreen() {
  const { wallets: walletsParam } = useLocalSearchParams<{ wallets: string }>()
  const [saving, setSaving] = useState(false)

  const wallets: WalletPayload[] = React.useMemo(() => {
    if (!walletsParam) return []
    try {
      return JSON.parse(walletsParam) as WalletPayload[]
    } catch {
      return []
    }
  }, [walletsParam])

  async function handleGoToDashboard() {
    setSaving(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated. Please log in again.')
        return
      }

      if (wallets.length > 0) {
        const { error: insertError } = await supabase
          .from('wallets')
          .insert(wallets.map((w) => ({ ...w, user_id: user.id })))

        if (insertError) {
          Alert.alert('Error', insertError.message ?? 'Failed to save wallets.')
          return
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (profileError) {
        Alert.alert('Error', profileError.message ?? 'Failed to update profile.')
        return
      }

      router.replace('/(tabs)')
    } catch (err) {
      console.error('Onboarding done error:', err)
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.heading}>You're all set!</Text>
        <Text style={styles.subheading}>
          Here's a summary of the wallets you're adding:
        </Text>

        {wallets.length > 0 ? (
          <View style={styles.walletList}>
            {wallets.map((w, index) => (
              <View key={index} style={styles.walletItem}>
                <Text style={styles.walletName}>{w.name}</Text>
                <Text style={styles.walletMeta}>
                  {TYPE_LABELS[w.type] ?? w.type} · {w.currency} ·{' '}
                  {w.opening_balance.toFixed(2)}
                </Text>
                {w.credit_limit !== undefined && (
                  <Text style={styles.walletMetaSecondary}>
                    Limit: {w.credit_limit.toFixed(2)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No wallets added.</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.dashboardButton, saving ? styles.dashboardButtonDisabled : null]}
        onPress={handleGoToDashboard}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.dashboardButtonText}>Go to dashboard</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f9fafb',
    padding: 28,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  walletList: {
    gap: 12,
    marginBottom: 32,
  },
  walletItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  walletMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  walletMetaSecondary: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 15,
    marginBottom: 32,
  },
  dashboardButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  dashboardButtonDisabled: {
    opacity: 0.6,
  },
  dashboardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
