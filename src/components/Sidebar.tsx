'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',        icon: '📊', section: 'main' },
  { href: '/clients',    label: 'Clients',           icon: '🏢', section: 'main' },
  { href: '/tasks',      label: 'Tasks',             icon: '✅', section: 'main', badge: true },
  { href: '/templates',  label: 'Email Templates',   icon: '✉️', section: 'communication' },
]

interface SidebarProps {
  overdueCount?: number
  userEmail?: string
}

export default function Sidebar({ overdueCount = 0, userEmail = '' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userEmail ? userEmail[0].toUpperCase() : 'J'

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r border-teal-200/40 shadow-[2px_0_12px_rgba(0,80,70,0.08)]"
      style={{
        background: 'linear-gradient(170deg, #cce8e5 0%, #a8d8d4 55%, #90ceca 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-teal-600/10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-base flex-shrink-0 shadow-md"
          style={{ background: 'linear-gradient(135deg,#e8622a,#f97316)' }}
        >
          A
        </div>
        <div>
          <div className="text-[#134e4a] font-extrabold text-sm leading-tight">Abingh Portal</div>
          <div className="text-[#3d7a76] text-[11px] mt-0.5">Client Management</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 flex flex-col gap-0.5">
        <p className="text-[10px] font-bold text-[#4a8a85] uppercase tracking-widest px-2.5 pt-3 pb-1">
          Main
        </p>

        {navItems.filter(i => i.section === 'main').map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-white text-[#134e4a] shadow-sm border-l-[3px] border-[#e8622a] pl-[9px]'
                  : 'text-[#1e5e59] hover:bg-white/40 hover:text-[#134e4a]'
              }`}
            >
              <span className="text-sm w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && overdueCount > 0 && (
                <span className="bg-[#e8622a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {overdueCount}
                </span>
              )}
            </Link>
          )
        })}

        <p className="text-[10px] font-bold text-[#4a8a85] uppercase tracking-widest px-2.5 pt-4 pb-1">
          Communication
        </p>

        {navItems.filter(i => i.section === 'communication').map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-white text-[#134e4a] shadow-sm border-l-[3px] border-[#e8622a] pl-[9px]'
                  : 'text-[#1e5e59] hover:bg-white/40 hover:text-[#134e4a]'
              }`}
            >
              <span className="text-sm w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-teal-600/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/40 transition-colors text-left"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#e8622a,#f97316)' }}
          >
            {initial}
          </div>
          <div>
            <div className="text-[#134e4a] text-sm font-bold leading-tight truncate max-w-[120px]">
              {userEmail || 'Jay'}
            </div>
            <div className="text-[#4a8a85] text-[11px]">Sign out</div>
          </div>
        </button>
      </div>
    </aside>
  )
}
