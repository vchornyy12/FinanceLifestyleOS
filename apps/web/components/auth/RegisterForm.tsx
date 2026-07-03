'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { registerUser, type RegisterState } from '@/lib/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-mac-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mac-accent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  )
}

export default function RegisterForm() {
  const [state, formAction] = useActionState<RegisterState, FormData>(
    registerUser,
    null,
  )

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-mac-label">
            Check your email
          </h1>
          <p className="text-sm text-mac-secondary">
            {state.success}
          </p>
        </div>
        <p className="text-sm text-mac-secondary">
          Already confirmed?{' '}
          <Link
            href="/login"
            className="font-medium text-mac-accent underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-mac-label">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-mac-secondary">
          Start managing your financial lifestyle
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
            aria-invalid={!!state?.fieldErrors?.email}
            aria-describedby={state?.fieldErrors?.email ? 'email-error' : undefined}
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
            placeholder="you@example.com"
          />
          {state?.fieldErrors?.email?.[0] && (
            <p id="email-error" className="mt-1 text-xs text-mac-red">
              {state.fieldErrors.email[0]}
            </p>
          )}
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
            autoComplete="new-password"
            required
            aria-invalid={!!state?.fieldErrors?.password}
            aria-describedby={state?.fieldErrors?.password ? 'password-error' : undefined}
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
            placeholder="Min 8 chars, include a number"
          />
          {state?.fieldErrors?.password?.[0] && (
            <p id="password-error" className="mt-1 text-xs text-mac-red">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-mac-secondary"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!state?.fieldErrors?.confirmPassword}
            aria-describedby={state?.fieldErrors?.confirmPassword ? 'confirm-password-error' : undefined}
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
            placeholder="••••••••"
          />
          {state?.fieldErrors?.confirmPassword?.[0] && (
            <p id="confirm-password-error" className="mt-1 text-xs text-mac-red">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-mac-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-mac-accent underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
