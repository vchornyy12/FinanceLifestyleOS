import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TransactionForm, TransactionFormData } from '@/components/transactions/TransactionForm'

export default function NewTransactionScreen() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  async function handleSave(data: TransactionFormData) {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: data.type,
        amount: parseFloat(data.amount),
        merchant: data.merchant,
        category_id: data.categoryId,
        date: data.date,
        note: data.note || null,
        source: 'manual',
        from_account: data.fromAccount,
        to_account: data.toAccount,
      })

      if (error) {
        console.error('Insert transaction error:', error)
        Alert.alert('Error', error.message ?? 'Failed to save transaction.')
      } else {
        router.back()
      }
    } catch (err) {
      console.error('Insert transaction exception:', err)
      Alert.alert('Error', 'Failed to save transaction. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'New Transaction', headerBackTitle: 'Back' }} />
      <TransactionForm onSave={handleSave} saving={saving} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
})
