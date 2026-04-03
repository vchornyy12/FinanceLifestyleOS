import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function Verify2FAScreen() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const initChallenge = async () => {
      setLoading(true)
      setError(null)
      // Step 1: get TOTP factor ID
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError || !factorsData?.totp?.length) {
        setError('No MFA factor found. Please contact support.')
        setLoading(false)
        return
      }
      const id = factorsData.totp[0].id
      setFactorId(id)
      // Step 2: create challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: id })
      if (challengeError || !challengeData) {
        setError('Failed to initiate MFA challenge. Please try again.')
        setLoading(false)
        return
      }
      setChallengeId(challengeData.id)
      setLoading(false)
    }
    initChallenge()
  }, [])

  const handleVerify = async () => {
    if (!factorId || !challengeId) {
      setError('MFA challenge not ready. Please wait.')
      return
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setError(null)
    setVerifying(true)
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })
    if (verifyError) {
      setError('Invalid code. Please try again.')
      setCode('')
      setVerifying(false)
      return
    }
    // On success, NavigationGuard detects aal2 session and redirects to /(tabs)
    setVerifying(false)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-zinc-950 justify-center px-6"
    >
      <Text className="text-2xl font-bold mb-2 dark:text-white">Two-Factor Authentication</Text>
      <Text className="text-zinc-600 dark:text-zinc-400 mb-8 text-sm">
        Enter the 6-digit code from your authenticator app.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <View className="gap-4">
          {error && (
            <View className="gap-3">
              <Text className="text-red-500 text-sm text-center">{error}</Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text className="text-blue-600 text-sm text-center">Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm dark:bg-zinc-800 dark:text-white text-center tracking-widest"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            onPress={handleVerify}
            disabled={verifying}
            className="bg-blue-600 rounded-lg py-3 items-center"
          >
            {verifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">Verify</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
