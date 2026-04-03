import { useState } from 'react'
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

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/\d/.test(pw)) return 'Password must contain at least one number'
  return null
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError(null)
    if (!email.trim()) { setError('Email is required'); return }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    // MFA check — if user has enrolled TOTP, require second factor
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
      setLoading(false)
      router.push('/(auth)/verify-2fa')
      return
    }
    // If no MFA needed, NavigationGuard handles redirect to /(tabs)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-zinc-950 justify-center px-6"
    >
      <Text className="text-2xl font-bold mb-8 dark:text-white">Sign In</Text>
      <View className="gap-4">
        {error && <Text className="text-red-500 text-sm">{error}</Text>}
        <TextInput
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm dark:bg-zinc-800 dark:text-white"
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm dark:bg-zinc-800 dark:text-white"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-blue-600 rounded-lg py-3 items-center"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Sign In</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text className="text-center text-blue-600 text-sm">
            Don&apos;t have an account? Register
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
