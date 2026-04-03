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

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError(null)
    if (!email) {
      setError('Email is required')
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    // Don't auto-navigate — show confirmation message
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950 justify-center px-6">
        <Text className="text-2xl font-bold mb-4 dark:text-white">Check your email</Text>
        <Text className="text-zinc-600 dark:text-zinc-400 mb-8">
          We sent a confirmation link to {email}. Please verify your email before signing in.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text className="text-center text-blue-600 text-sm">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-zinc-950 justify-center px-6"
    >
      <Text className="text-2xl font-bold mb-8 dark:text-white">Create Account</Text>
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
        <TextInput
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm dark:bg-zinc-800 dark:text-white"
          placeholder="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          className="bg-blue-600 rounded-lg py-3 items-center"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Create Account</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text className="text-center text-blue-600 text-sm">
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
