import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMFAStatus } from '@/lib/actions/mfa'
import TwoFactorVerify from '@/components/auth/TwoFactorVerify'

export const metadata: Metadata = {
  title: 'Two-factor authentication — Finance Lifestyle OS',
}

export default async function VerifyTwoFactorPage() {
  const { factors } = await getMFAStatus()

  if (!factors || factors.length === 0) {
    redirect('/dashboard')
  }

  return <TwoFactorVerify factorId={factors[0].id} />
}
