import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

type WalletType = 'cash' | 'debit' | 'credit_card' | 'savings' | 'investment' | 'crypto'

interface WalletDraft {
  id: string
  name: string
  type: WalletType
  currency: string
  opening_balance: number
  credit_limit?: number
}

const WALLET_TYPES: { label: string; value: WalletType }[] = [
  { label: '💵 Cash', value: 'cash' },
  { label: '🏦 Debit', value: 'debit' },
  { label: '💳 Credit Card', value: 'credit_card' },
  { label: '🏧 Savings', value: 'savings' },
  { label: '📈 Investment', value: 'investment' },
  { label: '₿ Crypto', value: 'crypto' },
]

export default function AddWalletsScreen() {
  const [wallets, setWallets] = useState<WalletDraft[]>([])
  const [skipping, setSkipping] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<WalletType>('debit')
  const [currency, setCurrency] = useState('PLN')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [creditLimit, setCreditLimit] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  function validateForm(): boolean {
    const errors: Record<string, string> = {}
    if (!name.trim()) {
      errors.name = 'Name is required.'
    }
    if (type === 'credit_card' && (!creditLimit.trim() || parseFloat(creditLimit) <= 0)) {
      errors.creditLimit = 'Credit limit must be greater than 0 for credit cards.'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleAddWallet() {
    if (!validateForm()) return

    const draft: WalletDraft = {
      id: Date.now().toString(),
      name: name.trim(),
      type,
      currency: currency.trim() || 'PLN',
      opening_balance: parseFloat(openingBalance) || 0,
    }
    if (type === 'credit_card' && creditLimit.trim()) {
      draft.credit_limit = parseFloat(creditLimit)
    }

    setWallets((prev) => [...prev, draft])

    // Reset form
    setName('')
    setType('debit')
    setCurrency('PLN')
    setOpeningBalance('0')
    setCreditLimit('')
    setFormErrors({})
  }

  function handleRemoveWallet(id: string) {
    setWallets((prev) => prev.filter((w) => w.id !== id))
  }

  function handleContinue() {
    if (wallets.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const payload = wallets.map(({ id, ...rest }) => rest)
    router.push({
      pathname: '/(onboarding)/done',
      params: { wallets: JSON.stringify(payload) },
    })
  }

  async function handleSkip() {
    setSkipping(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        Alert.alert('Error', 'Not authenticated. Please log in again.')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to update profile.')
        return
      }

      router.replace('/(tabs)')
    } catch (err) {
      console.error('Onboarding skip error:', err)
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Add your wallets</Text>
        <Text style={styles.subheading}>
          Add one or more accounts. You can always add more later.
        </Text>

        {/* Added wallets list */}
        {wallets.length > 0 && (
          <View style={styles.walletList}>
            {wallets.map((w) => {
              const typeLabel = WALLET_TYPES.find((t) => t.value === w.type)?.label ?? w.type
              return (
                <View key={w.id} style={styles.walletItem}>
                  <View style={styles.walletItemInfo}>
                    <Text style={styles.walletItemName}>{w.name}</Text>
                    <Text style={styles.walletItemMeta}>
                      {typeLabel} · {w.currency} · {w.opening_balance.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveWallet(w.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>New wallet</Text>

          {/* Type picker */}
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeGrid}>
              {WALLET_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeOption, type === t.value ? styles.typeOptionSelected : null]}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === t.value ? styles.typeOptionTextSelected : null,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, formErrors.name ? styles.inputError : null]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Account"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
            />
            {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}
          </View>

          {/* Currency */}
          <View style={styles.field}>
            <Text style={styles.label}>Currency</Text>
            <TextInput
              style={styles.input}
              value={currency}
              onChangeText={setCurrency}
              placeholder="PLN"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>

          {/* Opening Balance */}
          <View style={styles.field}>
            <Text style={styles.label}>Opening Balance</Text>
            <TextInput
              style={styles.input}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Credit Limit (credit_card only) */}
          {type === 'credit_card' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Credit Limit</Text>
              <TextInput
                style={[styles.input, formErrors.creditLimit ? styles.inputError : null]}
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="e.g. 5000.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
              {formErrors.creditLimit ? (
                <Text style={styles.errorText}>{formErrors.creditLimit}</Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddWallet}
            activeOpacity={0.85}
          >
            <Text style={styles.addButtonText}>+ Add wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Continue / Skip */}
        <TouchableOpacity
          style={[styles.continueButton, wallets.length === 0 ? styles.continueButtonDisabled : null]}
          onPress={handleContinue}
          disabled={wallets.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={skipping}
          activeOpacity={0.7}
        >
          {skipping ? (
            <ActivityIndicator color="#6b7280" />
          ) : (
            <Text style={styles.skipButtonText}>Skip for now</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 22,
  },
  walletList: {
    marginBottom: 24,
    gap: 10,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  walletItemInfo: {
    flex: 1,
  },
  walletItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  walletItemMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  removeButton: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    paddingLeft: 12,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  typeOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  typeOptionText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  typeOptionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 4,
  },
  addButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
})
