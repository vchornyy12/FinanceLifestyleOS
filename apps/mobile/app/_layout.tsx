import '../global.css'
import React, { useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { AuthProvider, useAuth } from '@/context/AuthContext'

const BIOMETRIC_KEY = 'biometric_enabled'
const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  // AppState / biometric lock state
  const appState = useRef<AppStateStatus>(AppState.currentState)
  const backgroundedAt = useRef<number | null>(null)
  const [biometricLocked, setBiometricLocked] = useState(false)

  // Handle biometric lock when app comes to foreground after >5 min
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        // App going to background — record time
        backgroundedAt.current = Date.now()
      } else if (
        nextState === 'active' &&
        appState.current.match(/inactive|background/)
      ) {
        // App coming to foreground
        const elapsed = backgroundedAt.current
          ? Date.now() - backgroundedAt.current
          : 0
        backgroundedAt.current = null

        if (elapsed > BACKGROUND_TIMEOUT_MS) {
          // Check if biometric is enabled and session exists
          const biometricEnabled = await SecureStore.getItemAsync(BIOMETRIC_KEY)
          if (biometricEnabled === 'true' && session) {
            setBiometricLocked(true)
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock Finance Lifestyle OS',
              fallbackLabel: 'Use Password',
            })
            if (result.success) {
              setBiometricLocked(false)
            } else {
              // Biometric failed → sign out and redirect to login
              setBiometricLocked(false)
              await signOut()
              router.replace('/(auth)/login')
            }
          }
        }
      }
      appState.current = nextState
    })

    return () => subscription.remove()
  }, [session, signOut])

  // Navigation guard: redirect based on auth state + biometric setup flow
  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const onBiometricSetup = (segments as string[])[1] === 'biometric-setup'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
      return
    }

    if (session && inAuthGroup && !onBiometricSetup) {
      // Authenticated: check if we need biometric setup (first time)
      async function checkBiometricSetup() {
        const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY)
        if (stored === null) {
          // Key doesn't exist yet — first login. Check if hardware is available.
          const hasHardware = await LocalAuthentication.hasHardwareAsync()
          const isEnrolled = await LocalAuthentication.isEnrolledAsync()
          if (hasHardware && isEnrolled) {
            router.replace('/(auth)/biometric-setup')
            return
          }
        }
        router.replace('/(tabs)')
      }
      checkBiometricSetup()
    }
  }, [session, loading, segments])

  if (biometricLocked) {
    // Render nothing while biometric prompt is shown
    return null
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </NavigationGuard>
    </AuthProvider>
  )
}
