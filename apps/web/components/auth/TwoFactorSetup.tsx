'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { enrollMFA, verifyMFAChallenge } from '@/lib/actions/mfa'

type Step = 'start' | 'scan' | 'done'

type EnrollResult =
  | { factorId: string; qrCode: string; secret: string; error?: never }
  | { error: string; factorId?: never; qrCode?: never; secret?: never }

function generateBackupCodes(): string[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
  )
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

// QR code SVG comes directly from the Supabase MFA enroll API (trusted first-party source).
// It is never derived from user-supplied input, so rendering it via innerHTML is safe here.
function QRCodeDisplay({ svg }: { svg: string }) {
  return (
    <div
      className="flex justify-center rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default function TwoFactorSetup() {
  const [step, setStep] = useState<Step>('start')
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [backupCodes] = useState<string[]>(() => generateBackupCodes())

  const [verifyState, verifyAction] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      const result = await verifyMFAChallenge(prevState, formData)
      // If no redirect happened, result contains an error
      if (result && typeof result === 'object' && 'error' in result) return result
      // On success the server redirects to /dashboard; if we somehow land here, show done
      setStep('done')
      return result
    },
    null,
  )

  async function handleStart() {
    setEnrolling(true)
    setEnrollError(null)
    const result: EnrollResult = await enrollMFA()
    setEnrolling(false)
    if ('error' in result) {
      setEnrollError(result.error ?? 'Enrollment failed. Please try again.')
      return
    }
    setEnrollData({ factorId: result.factorId, qrCode: result.qrCode, secret: result.secret })
    setStep('scan')
  }

  if (step === 'start') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Two-factor authentication adds an extra layer of security to your account. You will need
          an authenticator app (such as Google Authenticator or Authy) on your phone.
        </p>
        {enrollError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
          >
            {enrollError}
          </p>
        )}
        <button
          onClick={handleStart}
          disabled={enrolling}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {enrolling ? 'Setting up…' : 'Enable two-factor authentication'}
        </button>
      </div>
    )
  }

  if (step === 'scan' && enrollData) {
    const verifyError =
      verifyState && typeof verifyState === 'object' && 'error' in verifyState
        ? (verifyState as { error: string }).error
        : null

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Scan this QR code
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use your authenticator app to scan the QR code below, then enter the 6-digit code to
            confirm.
          </p>
        </div>

        <QRCodeDisplay svg={enrollData.qrCode} />

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Can&apos;t scan? Enter code manually
          </summary>
          <p className="mt-2 break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {enrollData.secret}
          </p>
        </details>

        <form action={verifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="factorId" value={enrollData.factorId} />
          <div>
            <label
              htmlFor="code"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Verification code
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
          {verifyError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
            >
              {verifyError}
            </p>
          )}
          <SubmitButton label="Verify and enable" pendingLabel="Verifying…" />
        </form>
      </div>
    )
  }

  // step === 'done'
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg bg-green-50 px-4 py-3 dark:bg-green-950">
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          Two-factor authentication enabled successfully.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Save your backup codes
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Store these codes somewhere safe. Each code can be used once if you lose access to your
          authenticator app. These codes will not be shown again.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {backupCodes.map((code) => (
          <li
            key={code}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-center font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {code}
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Note: These backup codes are for emergency access. Keep them in a secure location.
      </p>
    </div>
  )
}
