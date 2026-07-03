'use client'

import type { User } from '@supabase/supabase-js'
import { logoutUser } from '@/lib/actions/auth'

interface TopBarProps {
  user: User
  isChatOpen: boolean
  onToggleChat: () => void
}

export default function TopBar({ user, isChatOpen, onToggleChat }: TopBarProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Left: app name / breadcrumb area */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
          Finance Lifestyle OS
        </span>
      </div>

      {/* Right: toggle + user info + logout */}
      <div className="flex items-center gap-4">
        {/* Beautiful AI Coach Toggle Button */}
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isChatOpen
              ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60 focus-visible:outline-indigo-600'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/80 focus-visible:outline-zinc-900'
          }`}
        >
          <span className={`relative flex h-2 w-2 items-center justify-center`}>
            {isChatOpen ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            ) : null}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isChatOpen ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-emerald-500'}`} />
          </span>
          💬 AI Coach
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.email ?? 'your account'}
        </span>

        <form action={logoutUser}>
          <button
            type="submit"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
