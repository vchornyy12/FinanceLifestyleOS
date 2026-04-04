import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '@/lib/supabase'
import { ParsedReceipt } from '@/types/receipt'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

const TWO_MB = 2 * 1024 * 1024

/**
 * Compress an image URI to under 2 MB.
 * First attempt: quality 0.7; if still over 2 MB, reduce to 0.5.
 */
export async function compressImage(uri: string): Promise<{ uri: string }> {
  const first = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  )

  // Check file size via fetch
  const response = await fetch(first.uri)
  const blob = await response.blob()

  if (blob.size <= TWO_MB) {
    return { uri: first.uri }
  }

  // Second attempt with lower quality
  const second = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
  )
  return { uri: second.uri }
}

/**
 * Upload a compressed image to Supabase Storage under receipts/{userId}/{uuid}.jpg.
 * Returns the storage path string.
 */
export async function uploadReceiptImage(uri: string, userId: string): Promise<string> {
  const response = await fetch(uri)
  const blob = await response.blob()

  const uuid = crypto.randomUUID()
  const storagePath = `${userId}/${uuid}.jpg`

  const { error } = await supabase.storage
    .from('receipts')
    .upload(storagePath, blob, { contentType: 'image/jpeg' })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  return storagePath
}

/**
 * Call the OCR API route with the storage path.
 * Returns a ParsedReceipt or throws with the error code from the response body.
 */
export async function parseReceipt(
  storagePath: string,
  accessToken: string,
): Promise<ParsedReceipt> {
  if (!API_BASE_URL) throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured')
  const res = await fetch(`${API_BASE_URL}/api/receipts/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ storagePath }),
  })

  if (!res.ok) {
    let errorCode = `HTTP_${res.status}`
    try {
      const body = await res.json()
      if (body?.error) errorCode = body.error
      if (body?.code) errorCode = body.code
    } catch {
      // ignore parse errors
    }
    throw new Error(errorCode)
  }

  return res.json() as Promise<ParsedReceipt>
}
