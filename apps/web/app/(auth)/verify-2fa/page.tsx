import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMFAStatus } from '@/lib/actions/mfa'
import { createClient } from '@/lib/supabase/server'
import TwoFactorVerify from '@/components/auth/TwoFactorVerify'

export const metadata: Metadata = {
  title: 'Two-factor authentication — Finance Lifestyle OS',
}

export default async function VerifyTwoFactorPage() {
  const { factors } = await getMFAStatus()

  if (!factors || factors.length === 0) {
    redirect('/dashboard')
  }

  // If the user is already at AAL2 (MFA already verified), skip straight to dashboard
  const supabase = await createClient()
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalData?.currentLevel === 'aal2') {
    redirect('/dashboard')
  }

  return <TwoFactorVerify factorId={factors[0].id} />
}
