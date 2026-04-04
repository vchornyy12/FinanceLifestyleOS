import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { useBiometric } from '@/hooks/useBiometric'

export default function BiometricSetupScreen() {
  const { enable } = useBiometric()

  useEffect(() => {
    async function checkAndRedirect() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      if (!hasHardware || !isEnrolled) {
        router.replace('/(tabs)')
      }
    }
    checkAndRedirect()
  }, [])

  const handleEnable = async () => {
    const success = await enable()
    if (success) {
      router.replace('/(tabs)')
    }
    // if not success: stay on screen (user can try again or tap Skip)
  }

  const handleSkip = () => {
    router.replace('/(tabs)')
  }

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
