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
        amount: parseFloat(data.amount),
        merchant: data.merchant,
        category_id: data.categoryId,
        date: data.date,
        note: data.note || null,
        transaction_source: 'manual',
      })

      if (error) {
        Alert.alert('Error', 'Failed to save transaction. Please try again.')
      } else {
        router.back()
      }
    } catch (err) {
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
