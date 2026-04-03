import '../global.css'
import { Stack } from 'expo-router'

// TODO (T3): Add auth guard — check Supabase session on mount,
// redirect to (auth) if no session, redirect to (tabs) if authenticated.
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
