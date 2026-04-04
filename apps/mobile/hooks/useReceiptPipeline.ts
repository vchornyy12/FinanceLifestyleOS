import { useState } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { compressImage, uploadReceiptImage, parseReceipt } from '@/lib/receiptUpload'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function useReceiptPipeline() {
  const { user } = useAuth()
  const [processing, setProcessing] = useState(false)

  async function run(rawUri: string): Promise<void> {
    if (!user) return
    setProcessing(true)
    try {
      const { uri } = await compressImage(rawUri)
      const storagePath = await uploadReceiptImage(uri, user.id)
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token
      if (!accessToken) throw new Error('NOT_AUTHENTICATED')
      const data = await parseReceipt(storagePath, accessToken)

      // Blurry warning check
      const lowConfCount = data.items.filter(i => i.confidence === 'low').length
      const shouldWarn = data.items.length > 0 && lowConfCount / data.items.length > 0.5

      if (shouldWarn) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Receipt may be unclear',
            'More than half of the items have low confidence. Review carefully.',
            [{ text: 'Continue', onPress: () => resolve() }]
          )
        })
      }

      router.push({
        pathname: '/(review)/review',
        params: { receiptJson: JSON.stringify(data), storagePath },
      })
    } catch (err) {
      const code = err instanceof Error ? err.message : 'PARSE_FAILED'
      const messages: Record<string, string> = {
        UNAUTHENTICATED: 'Session expired. Please sign in again.',
        RATE_LIMITED: 'Too many requests. Please try again later.',
        TIMEOUT: 'Receipt parsing timed out. Please try again.',
        NOT_AUTHENTICATED: 'Session expired. Please sign in again.',
      }
      Alert.alert('Error', messages[code] ?? 'Failed to process receipt. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return { run, processing }
}
