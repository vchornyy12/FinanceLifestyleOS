'use client'

import { useState, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ChatSidebar from '@/components/layout/ChatSidebar'

interface DashboardShellProps {
  user: User
  children: ReactNode
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-mac-canvas">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar 
          user={user} 
          isChatOpen={isChatOpen} 
          onToggleChat={() => setIsChatOpen(!isChatOpen)} 
        />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
          {isChatOpen && <ChatSidebar />}
        </div>
      </div>
    </div>
  )
}
