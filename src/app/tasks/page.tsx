'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Task, TaskStatus, TASK_TYPE_LABELS } from '@/lib/types'

interface TaskWithClient extends Task {
  clients: { company_name: string; email: string; contact_first: string }
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; cls: string }[] = [
  { value: 'pending',        label: 'Pending',        cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  { value: 'info_requested', label: 'Info Requested', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'in_progress',    label: 'In Progress',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'done',           label: 'Done ✓',         cls: 'bg-green-50 text-green-700 border-green-200' },
]

const statusCls = (s: TaskStatus) => STATUS_OPTIONS.find(o => o.value === s)?.cls ?? ''

function TasksContent() {
  const [tasks, setTasks]     = useState<TaskWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const router      = useRouter()
  const searchParams = useSearchParams()
  const supabase    = createClient()

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f) setFilter(f)
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('tasks')
        .select('*, clients(company_name, email, contact_first)')
        .order('deadline', { ascending: true })

      setTasks((data as TaskWithClient[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const filtered = tasks.filter(t => {
    const d = new Date(t.deadline)
    if (filter === 'overdue')   return d < today && t.status !== 'done'
    if (filter === 'thisweek')  return d >= today && d <= weekEnd
    if (filter === 'thismonth') return d >= today && d <= monthEnd
    if (filter === 'upcoming')  return d > monthEnd
    if (filter === 'done')      return t.status === 'done'
    return true
  })

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  const overdueCount = tasks.filter(t => new Date(t.deadline) < today && t.status !== 'done').length

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const dayLabel = (iso: string) => {
    const d = new Date(iso); d.setHours(0,0,0,0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-600' }
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 font-bold' }
    if (diff <= 7) return { text: `${diff}d`, cls: 'text-amber-600' }
    return { text: `${diff}d`, cls: 'text-gray-400' }
  }

  const FILTERS = [
    { id: 'all',       label: 'All Tasks' },
    { id: 'overdue',   label: `⚠ Overdue (${overdueCount})` },
    { id: 'thisweek',  label: 'This Week' },
    { id: 'thismonth', label: 'This Month' },
    { id: 'upcoming',  label: 'Upcoming' },
    { id: 'done',      label: 'Done' },
  ]

  return (
    <>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-sm ${
              filter === f.id
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-16 text-center">Loading tasks…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">✅</div>
          <div className="text-gray-500 font-medium">No tasks in this view</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Client','Task','Deadline','Status',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const dl = dayLabel(t.deadline)
                const isOverdue = new Date(t.deadline) < today && t.status !== 'done'
                return (
                  <tr key={t.id} className={`border-b border-gray-50 hover:bg-teal-50/20 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-sm">{t.clients?.company_name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{TASK_TYPE_LABELS[t.task_type]}</div>
                      <div className="text-xs text-gray-400">{t.period_label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{fmtDate(t.deadline)}</div>
                      <div className={`text-xs font-semibold ${dl.cls}`}>{dl.text}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={e => updateStatus(t.id, e.target.value as TaskStatus)}
                        className={`border rounded-full text-xs font-bold py-1 pl-2.5 cursor-pointer transition-all hover:shadow-md ${statusCls(t.status)}`}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {t.clients?.email && (
                        <span className="text-xs text-gray-400 truncate max-w-[140px] block">{t.clients.email}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function TasksPage() {
  return (
    <AppLayout
      title="Tasks"
      subtitle="Your task overview"
    >
      <Suspense fallback={<div className="text-gray-400 text-sm py-16 text-center">Loading tasks…</div>}>
        <TasksContent />
      </Suspense>
    </AppLayout>
  )
}
