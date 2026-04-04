import { useEffect, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

export const BIOMETRIC_KEY = 'biometric_enabled'

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    async function checkBiometric() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      const available = hasHardware && isEnrolled
      setIsAvailable(available)

      if (available) {
        const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY)
        setIsEnabled(stored === 'true')
      }
    }
    checkBiometric()
  }, [])

  const enable = async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Finance Lifestyle OS',
      fallbackLabel: 'Use Password',
    })
    if (result.success) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true')
      setIsEnabled(true)
      return true
    }
    return false
  }

  const authenticate = async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Finance Lifestyle OS',
      fallbackLabel: 'Use Password',
    })
    return result.success
  }

  const disable = async () => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, 'false')
    setIsEnabled(false)
  }

  return { isAvailable, isEnabled, enable, disable, authenticate }
}
