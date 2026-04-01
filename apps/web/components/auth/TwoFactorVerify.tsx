'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { verifyMFAChallenge } from '@/lib/actions/mfa'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? 'Verifying…' : 'Verify'}
    </button>
  )
}

interface TwoFactorVerifyProps {
  factorId: string
}

export default function TwoFactorVerify({ factorId }: TwoFactorVerifyProps) {
  const [state, formAction] = useActionState(verifyMFAChallenge, null)

  const error =
    state && typeof state === 'object' && 'error' in state
      ? (state as { error: string }).error
      : null

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Two-factor authentication
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <input type="hidden" name="factorId" value={factorId} />

      <div>
        <label
          htmlFor="code"
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Authentication code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="000000"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
      </div>

      <SubmitButton />
    </form>
  )
}
