'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Task, TASK_TYPE_LABELS, STATUS_LABELS, TaskStatus, TEAM_MEMBERS } from '@/lib/types'

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending:        'badge-gray',
  info_requested: 'badge-teal',
  in_progress:    'badge-amber',
  done:           'badge-green',
}

const DOT: Record<TaskStatus, string> = {
  pending:        'bg-gray-400',
  info_requested: 'bg-teal-500',
  in_progress:    'bg-amber-400',
  done:           'bg-green-500',
}

interface TaskWithClient extends Task {
  clients: { company_name: string; assigned_to?: string }
}

export default function DashboardPage() {
  const [tasks, setTasks]           = useState<TaskWithClient[]>([])
  const [clientCount, setClientCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const [{ data: taskData }, { count }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, clients(company_name, assigned_to)')
          .neq('status', 'done')
          .order('deadline', { ascending: true }),
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
      ])

      setTasks((taskData as TaskWithClient[]) ?? [])
      setClientCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const weekEnd  = new Date(today); weekEnd.setDate(today.getDate() + 7)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const overdue   = tasks.filter(t => new Date(t.deadline) < today)
  const thisWeek  = tasks.filter(t => { const d = new Date(t.deadline); return d >= today && d <= weekEnd })
  const thisMonth = tasks.filter(t => { const d = new Date(t.deadline); return d > weekEnd && d <= monthEnd })

  // Team workload: tasks per team member
  const teamStats = TEAM_MEMBERS.map(name => ({
    name,
    total:    tasks.filter(t => t.clients?.assigned_to === name).length,
    overdue:  tasks.filter(t => t.clients?.assigned_to === name && new Date(t.deadline) < today).length,
  })).filter(s => s.total > 0)

  // Current quarter Q2 2026 (Apr–Jun)
  const currentQ = 'Q2'
  const currentQLabel = 'Q2 2026'

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const dayDiff = (iso: string) => {
    const diff = Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000)
    if (diff < 0)   return `${Math.abs(diff)}d overdue`
    if (diff === 0) return 'Due today'
    return `${diff}d`
  }

  const TaskRow = ({ t, group }: { t: TaskWithClient; group: 'overdue' | 'week' | 'month' }) => (
    <div className={`bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm hover:shadow-md transition-all
      ${group === 'overdue' ? 'border-l-[3px] border-l-red-400' : group === 'week' ? 'border-l-[3px] border-l-amber-400' : 'border-l-[3px] border-l-teal-500'}`}>
      <div className="font-semibold text-gray-900 min-w-[160px]">{t.clients?.company_name ?? '—'}</div>
      <div className="text-gray-500 flex-1 text-xs">{TASK_TYPE_LABELS[t.task_type]} · {t.period_label}</div>
      {t.clients?.assigned_to && (
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{t.clients.assigned_to}</span>
      )}
      <span className={`badge-sm ${STATUS_BADGE[t.status]} flex items-center gap-1`}>
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[t.status]}`}/>
        {STATUS_LABELS[t.status]}
      </span>
      <div className={`text-xs font-bold ml-auto whitespace-nowrap ${group === 'overdue' ? 'text-red-600' : group === 'week' ? 'text-amber-600' : 'text-teal-700'}`}>
        {dayDiff(t.deadline)}
      </div>
    </div>
  )

  const Section = ({ label, items, group, color }: {
    label: string; items: TaskWithClient[]; group: 'overdue' | 'week' | 'month'; color: string
  }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${color}`}/>
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
        <span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2 py-0.5 rounded-full">{items.length}</span>
        {items.length > 5 && (
          <Link href="/tasks" className="ml-auto text-xs text-teal-600 font-semibold hover:underline">View all →</Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-5 text-center text-gray-400 text-sm">Nothing here ✓</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.slice(0, 8).map(t => <TaskRow key={t.id} t={t} group={group} />)}
          {items.length > 8 && (
            <Link href="/tasks" className="text-xs text-teal-600 font-semibold text-center py-1 hover:underline">
              + {items.length - 8} more
            </Link>
          )}
        </div>
      )}
    </div>
  )

  const statDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AppLayout
      title="Dashboard"
      subtitle={statDate}
      actions={
        <>
          <Link href="/clients/new" className="btn-outline text-xs py-1.5 px-3 rounded-lg">+ Add Client</Link>
          <Link href="/templates" className="btn-coral text-xs py-1.5 px-3 rounded-lg">✉ Send Emails</Link>
        </>
      }
    >
      {overdue.length > 0 && (
        <div className="rounded-xl p-4 mb-5 flex items-center justify-between gap-3 shadow-md"
          style={{ background: 'linear-gradient(135deg,#0f766e,#134e4a)' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <div className="text-white font-bold text-sm">{overdue.length} task{overdue.length !== 1 ? 's' : ''} overdue</div>
              <div className="text-white/70 text-xs mt-0.5">These need your attention right away</div>
            </div>
          </div>
          <Link href="/tasks?filter=overdue"
            className="bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap">
            View Tasks →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-16 text-center">Loading…</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Overdue',        value: overdue.length,   color: 'text-red-600',  accent: 'from-red-400 to-rose-400',    icon: '🚨', hint: 'past deadline' },
              { label: 'Due This Week',  value: thisWeek.length,  color: 'text-amber-600',accent: 'from-amber-400 to-yellow-400', icon: '📅', hint: `by ${weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` },
              { label: 'Due This Month', value: thisMonth.length, color: 'text-teal-700',  accent: 'from-teal-500 to-emerald-400', icon: '📋', hint: `by ${monthEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` },
              { label: 'Total Open',     value: tasks.length,     color: 'text-gray-800',  accent: 'from-gray-400 to-slate-400',   icon: '📂', hint: 'not yet done' },
              { label: 'Active Clients', value: clientCount,      color: 'text-indigo-700',accent: 'from-indigo-400 to-purple-400', icon: '🏢', hint: 'active status' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.accent} rounded-t-xl`}/>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 bg-gray-50">{s.icon}</div>
                <div className={`text-3xl font-extrabold leading-none tracking-tight ${s.color}`}>{s.value}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1.5">{s.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{s.hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-5 mb-6">
            {/* Team workload */}
            {teamStats.length > 0 && (
              <div className="col-span-2 card p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Team Workload — Open Tasks</p>
                <div className="space-y-2.5">
                  {teamStats.sort((a,b) => b.total - a.total).map(s => (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                        {s.name[0]}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-20">{s.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-teal-500 transition-all"
                          style={{ width: `${Math.min(100, (s.total / Math.max(...teamStats.map(x => x.total))) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-6 text-right">{s.total}</span>
                      {s.overdue > 0 && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">{s.overdue} late</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current quarter quick stats */}
            <div className="card p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{currentQLabel} Progress</p>
              {(() => {
                const qTasks = tasks.filter(t => t.period_label?.includes(currentQ))
                const allQ   = qTasks.length
                const done   = qTasks.filter(t => t.status === 'done').length
                const pct    = allQ > 0 ? Math.round((done / allQ) * 100) : 0
                return (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{done} done</span><span>{allQ} total</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-3">
                      <div className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-2xl font-extrabold text-teal-700">{pct}%</p>
                    <p className="text-xs text-gray-400">completed this quarter</p>
                  </div>
                )
              })()}
            </div>
          </div>

          <Section label="Overdue"       items={overdue}   group="overdue" color="bg-red-400" />
          <Section label="Due This Week" items={thisWeek}  group="week"    color="bg-amber-400" />
          <Section label="Due This Month" items={thisMonth} group="month"   color="bg-teal-500" />
        </>
      )}
    </AppLayout>
  )
}
