import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function OnboardingWelcomeScreen() {
  const [skipping, setSkipping] = useState(false)

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
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Let's set up your accounts</Text>
        <Text style={styles.body}>
          Wallets let you track all your money in one place — cash, bank accounts, credit cards,
          savings, investments, and crypto. Add your accounts now so every transaction is
          automatically assigned to the right wallet.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(onboarding)/add-wallets')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSkip}
          disabled={skipping}
          activeOpacity={0.7}
        >
          {skipping ? (
            <ActivityIndicator color="#6b7280" />
          ) : (
            <Text style={styles.secondaryButtonText}>Skip for now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
})
