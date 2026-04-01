import type { Metadata } from 'next'
import { getMFAStatus, unenrollMFA } from '@/lib/actions/mfa'
import TwoFactorSetup from '@/components/auth/TwoFactorSetup'

export const metadata: Metadata = {
  title: 'Security Settings — Finance Lifestyle OS',
}

export default async function SecuritySettingsPage() {
  const { factors } = await getMFAStatus()
  const isEnabled = factors && factors.length > 0
  const activeFactor = isEnabled ? factors[0] : null

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Security Settings
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Manage your account security preferences.
      </p>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Two-factor authentication
        </h2>

        {isEnabled && activeFactor ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Two-factor authentication is{' '}
              <span className="font-semibold text-green-700 dark:text-green-400">enabled</span> on
              your account.
            </p>

            <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Are you sure? This will disable 2FA on your account and make it less secure.
              </p>
            </div>

            <form
              action={async () => {
                'use server'
                await unenrollMFA(activeFactor.id)
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
              >
                Disable two-factor authentication
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-3">
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Two-factor authentication is{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">not enabled</span>.
            </p>
            <TwoFactorSetup />
          </div>
        )}
      </section>
    </div>
  )
}
