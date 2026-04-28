import React, { useState } from 'react'
import {
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
import { router, Stack } from 'expo-router'
import { supabase } from '@/lib/supabase'

type WalletType = 'cash' | 'debit' | 'credit_card' | 'savings' | 'investment' | 'crypto'

const WALLET_TYPES: { label: string; value: WalletType }[] = [
  { label: '💵 Cash', value: 'cash' },
  { label: '🏦 Debit', value: 'debit' },
  { label: '💳 Credit Card', value: 'credit_card' },
  { label: '🏧 Savings', value: 'savings' },
  { label: '📈 Investment', value: 'investment' },
  { label: '₿ Crypto', value: 'crypto' },
]

export default function NewWalletScreen() {
  const [name, setName] = useState('')
  const [type, setType] = useState<WalletType>('debit')
  const [currency, setCurrency] = useState('PLN')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [creditLimit, setCreditLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required.'
    }
    if (type === 'credit_card' && (!creditLimit.trim() || parseFloat(creditLimit) <= 0)) {
      newErrors.creditLimit = 'Credit limit is required and must be greater than 0 for credit cards.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

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

      const payload: Record<string, unknown> = {
        user_id: user.id,
        name: name.trim(),
        type,
        currency: currency.trim() || 'PLN',
        opening_balance: parseFloat(openingBalance) || 0,
      }

      if (type === 'credit_card') {
        payload.credit_limit = parseFloat(creditLimit)
      }

      const { error } = await supabase.from('wallets').insert(payload)

      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to create wallet.')
      } else {
        router.back()
      }
    } catch (err) {
      console.error('NewWallet insert error:', err)
      Alert.alert('Error', 'Failed to create wallet. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Add Wallet', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Account"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        {/* Type */}
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
              style={[styles.input, errors.creditLimit ? styles.inputError : null]}
              value={creditLimit}
              onChangeText={setCreditLimit}
              placeholder="e.g. 5000.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
            {errors.creditLimit ? (
              <Text style={styles.errorText}>{errors.creditLimit}</Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, saving ? styles.submitButtonDisabled : null]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Add Wallet'}</Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  typeOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  typeOptionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
