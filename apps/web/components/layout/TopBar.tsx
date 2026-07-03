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
    <header className="mac-material flex h-12 flex-shrink-0 items-center justify-between border-b border-mac-hairline px-4">
      {/* Left: app name / breadcrumb area */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold tracking-tight text-mac-label">
          Finance Lifestyle OS
        </span>
      </div>

      {/* Right: toggle + user info + logout */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mac-accent ${
            isChatOpen
              ? 'bg-mac-accent/15 text-mac-accent'
              : 'text-mac-secondary hover:bg-mac-label/5 hover:text-mac-label'
          }`}
        >
          💬 AI Coach
        </button>

        <div className="h-4 w-px bg-mac-hairline" />

        <span className="text-xs text-mac-secondary">
          {user.email ?? 'your account'}
        </span>

        <form action={logoutUser}>
          <button
            type="submit"
            className="rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-1.5 text-xs font-medium text-mac-label transition-colors hover:bg-mac-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mac-accent"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
