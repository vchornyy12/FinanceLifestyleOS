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
      className="w-full rounded-lg bg-mac-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mac-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
        <h1 className="text-xl font-semibold text-mac-label">
          Two-factor authentication
        </h1>
        <p className="mt-1 text-sm text-mac-secondary">
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
          className="mb-1.5 block text-sm font-medium text-mac-secondary"
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
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
      </div>

      <SubmitButton />
    </form>
  )
}
