import type { Metadata } from 'next'
import RegisterForm from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Create account | Finance Lifestyle OS',
  description: 'Create a new Finance Lifestyle OS account.',
}

export default function RegisterPage() {
  return <RegisterForm />
}
