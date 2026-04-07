import { Stack } from 'expo-router'

export default function ReviewLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="review"
        options={{ title: 'Review Receipt', headerBackTitle: 'Back' }}
      />
    </Stack>
  )
}
