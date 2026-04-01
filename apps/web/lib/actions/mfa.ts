'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function enrollMFA() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) return { error: error.message }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code, // SVG string
    secret: data.totp.secret, // manual entry fallback
  }
}

export async function verifyMFAChallenge(prevState: unknown, formData: FormData) {
  const code = formData.get('code') as string
  const factorId = formData.get('factorId') as string
  const supabase = await createClient()

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) return { error: challengeError.message }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  })
  if (verifyError) return { error: 'Invalid code. Please try again.' }

  redirect('/dashboard')
}

export async function unenrollMFA(factorId: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings/security')
  return { success: true }
}

export async function getMFAStatus() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { factors: [], error: error.message }
  return { factors: data.totp }
}
