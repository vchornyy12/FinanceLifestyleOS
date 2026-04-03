import { Stack } from 'expo-router'
import { View } from 'react-native'

export default function AuthLayout() {
  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  )
}
