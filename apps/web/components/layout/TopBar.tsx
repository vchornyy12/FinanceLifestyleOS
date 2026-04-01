import type { User } from '@supabase/supabase-js'
import { logoutUser } from '@/lib/actions/auth'

interface TopBarProps {
  user: User
}

export default async function TopBar({ user }: TopBarProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Left: app name / breadcrumb area */}
      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Finance Lifestyle OS
      </span>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {user.email ?? 'your account'}
        </span>

        <form action={logoutUser}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
