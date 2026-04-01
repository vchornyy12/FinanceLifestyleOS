import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in — Finance Lifestyle OS',
}

export default function LoginPage() {
  return <LoginForm />
}
