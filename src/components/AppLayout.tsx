'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const [overdueCount, setOverdueCount] = useState(0)
  const [userEmail, setUserEmail] = useState('')
  const supabase = createClient()

  const loadOverdue = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .lt('deadline', today)
      .neq('status', 'done')
    setOverdueCount(count ?? 0)
  }

  useEffect(() => {
    // Listen for auth state — handles token refresh automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? '')
        loadOverdue()
      }
    })

    // Also load on mount in case listener fires before component is ready
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? '')
        loadOverdue()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar overdueCount={overdueCount} userEmail={userEmail} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <div>
            <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
