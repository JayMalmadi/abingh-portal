'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Task, TASK_TYPE_LABELS, STATUS_LABELS, TaskStatus } from '@/lib/types'

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
  clients: { company_name: string }
}

export default function DashboardPage() {
  const [tasks, setTasks]     = useState<TaskWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('tasks')
        .select('*, clients(company_name)')
        .neq('status', 'done')
        .order('deadline', { ascending: true })

      setTasks((data as TaskWithClient[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const overdue   = tasks.filter(t => new Date(t.deadline) < today)
  const thisWeek  = tasks.filter(t => { const d = new Date(t.deadline); return d >= today && d <= weekEnd })
  const thisMonth = tasks.filter(t => { const d = new Date(t.deadline); return d > weekEnd && d <= monthEnd })

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const dayDiff = (iso: string) => {
    const diff = Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000)
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return 'Due today'
    return `${diff} days`
  }

  const TaskRow = ({ t, group }: { t: TaskWithClient; group: 'overdue' | 'week' | 'month' }) => (
    <div className={`bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm hover:shadow-md hover:-translate-y-px transition-all cursor-default
      ${group === 'overdue' ? 'border-l-[3px] border-l-red-400' : group === 'week' ? 'border-l-[3px] border-l-amber-400' : 'border-l-[3px] border-l-teal-500'}`}>
      <div className="font-semibold text-gray-900 min-w-[180px]">
        {t.clients?.company_name ?? '—'}
      </div>
      <div className="text-gray-500 flex-1">
        {TASK_TYPE_LABELS[t.task_type]} · {t.period_label}
      </div>
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
    label: string
    items: TaskWithClient[]
    group: 'overdue' | 'week' | 'month'
    color: string
  }) => (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${color}`}/>
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
        <span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
          Nothing here ✓
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map(t => <TaskRow key={t.id} t={t} group={group} />)}
        </div>
      )}
    </div>
  )

  const statDate = today.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

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
      {/* Alert banner (only shown when there are overdue tasks) */}
      {overdue.length > 0 && (
        <div
          className="rounded-xl p-4 mb-5 flex items-center justify-between gap-3 shadow-md"
          style={{ background: 'linear-gradient(135deg,#0f766e,#134e4a)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <div className="text-white font-bold text-sm">{overdue.length} task{overdue.length !== 1 ? 's' : ''} overdue</div>
              <div className="text-white/70 text-xs mt-0.5">These need your attention right away</div>
            </div>
          </div>
          <Link
            href="/tasks?filter=overdue"
            className="bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            View Tasks →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="text-gray-400 text-sm py-16 text-center">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Overdue', value: overdue.length, color: 'text-red-600', accent: 'from-red-400 to-rose-400', icon: '🚨', hint: 'past deadline' },
              { label: 'Due This Week', value: thisWeek.length, color: 'text-amber-600', accent: 'from-amber-400 to-yellow-400', icon: '📅', hint: `by ${weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` },
              { label: 'Due This Month', value: thisMonth.length, color: 'text-teal-700', accent: 'from-teal-500 to-emerald-400', icon: '📋', hint: `by ${monthEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` },
              { label: 'Total Open', value: tasks.length, color: 'text-gray-800', accent: 'from-gray-400 to-slate-400', icon: '📂', hint: 'not yet done' },
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

          <Section label="Overdue"      items={overdue}   group="overdue" color="bg-red-400" />
          <Section label="Due This Week" items={thisWeek}  group="week"    color="bg-amber-400" />
          <Section label="Due This Month" items={thisMonth} group="month"   color="bg-teal-500" />
        </>
      )}
    </AppLayout>
  )
}
