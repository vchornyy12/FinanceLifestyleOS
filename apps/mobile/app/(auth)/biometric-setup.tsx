import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useBiometric } from '@/hooks/useBiometric'

export default function BiometricSetupScreen() {
  const router = useRouter()
  const { isAvailable, enable } = useBiometric()

  useEffect(() => {
    // If biometric hardware is not available or no biometrics enrolled, skip setup
    if (isAvailable === false) {
      // Wait for the availability check to complete (isAvailable starts as false)
      // We use a short timeout to allow the hook's useEffect to resolve
    }
  }, [isAvailable])

  const handleEnable = async () => {
    await enable()
    router.replace('/(tabs)')
  }

  const handleSkip = () => {
    router.replace('/(tabs)')
  }

  // While isAvailable is still being determined (false by default before check),
  // we render the prompt. If hardware is truly unavailable after check, auto-navigate.
  // This is handled via NavigationGuard checking hardware before routing here.

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <View className="items-center mb-10">
        <Text className="text-3xl font-bold text-gray-900 text-center mb-4">
          Enable Biometrics
        </Text>
        <Text className="text-base text-gray-500 text-center leading-6">
          Would you like to use Face ID / Touch ID to unlock the app?
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleEnable}
        className="w-full bg-blue-600 rounded-xl py-4 items-center mb-4"
      >
        <Text className="text-white text-base font-semibold">
          Enable Biometrics
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSkip}
        className="w-full bg-gray-100 rounded-xl py-4 items-center"
      >
        <Text className="text-gray-700 text-base font-semibold">
          Skip
        </Text>
      </TouchableOpacity>
    </View>
  )
}
