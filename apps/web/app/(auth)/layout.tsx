import type { ReactNode } from 'react'

export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-mac-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-mac-hairline bg-mac-surface p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  )
}
