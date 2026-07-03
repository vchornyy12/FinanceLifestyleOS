'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginUser, type LoginState } from '@/lib/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-mac-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mac-accent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  )
}

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginUser, null)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-mac-label">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-mac-secondary">
          Welcome back to Finance Lifestyle OS
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-mac-secondary"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-mac-secondary"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
            placeholder="••••••••"
          />
        </div>
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-mac-secondary">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-mac-accent underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  )
}
