'use client'

import React, { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Task, TaskStatus, TASK_TYPE_LABELS } from '@/lib/types'

interface TaskWithClient extends Task {
  clients: { company_name: string; email: string; contact_first: string; assigned_to?: string }
}

interface TaskComment {
  id: string
  task_id: string
  comment: string
  is_auto: boolean
  added_by: string
  created_at: string
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; cls: string }[] = [
  { value: 'pending',        label: 'Pending',        cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  { value: 'info_requested', label: 'Info Requested', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'in_progress',    label: 'In Progress',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'done',           label: 'Done ✓',         cls: 'bg-green-50 text-green-700 border-green-200' },
]

const QUICK_COMMENTS = [
  '✅ Info Received',
  '📨 Reminder Sent',
  '⏳ Waiting for Client',
  '📁 Filed',
  '❌ NIL Return Filed',
  '↗ Forwarded to Client',
  '🔍 Under Review',
  '💬 Called Client',
]

const CURRENT_YEAR = 2026

const QUARTER_FILTERS = [
  { id: 'q1', label: 'Q1 2026', match: ['Q1'] },
  { id: 'q2', label: 'Q2 2026', match: ['Q2'] },
  { id: 'q3', label: 'Q3 2026', match: ['Q3'] },
  { id: 'q4', label: 'Q4 2026', match: ['Q4'] },
  { id: 'annual', label: `Annual ${CURRENT_YEAR}`, match: ['CIT', 'Annual Accounts'] },
]

const statusCls = (s: TaskStatus) => STATUS_OPTIONS.find(o => o.value === s)?.cls ?? ''

function nameFromEmail(email: string) {
  const map: Record<string, string> = { 'jay@abingh.com': 'Jay' }
  return map[email] ?? email.split('@')[0]
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function TasksContent() {
  const [tasks, setTasks]         = useState<TaskWithClient[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [quarterFilter, setQuarterFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [commentsMap, setCommentsMap]     = useState<Record<string, TaskComment[]>>({})
  const [commentInput, setCommentInput]   = useState<Record<string, string>>({})
  const [savingComment, setSavingComment] = useState<string | null>(null)
  const currentUserRef = useRef({ id: '', name: 'Jay' })

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  useEffect(() => {
    const f = searchParams.get('filter')
    if (f) setFilter(f)
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      currentUserRef.current = { id: user.id, name: nameFromEmail(user.email ?? '') }

      const { data } = await supabase
        .from('tasks')
        .select('*, clients(company_name, email, contact_first, assigned_to)')
        .order('deadline', { ascending: true })

      setTasks((data as TaskWithClient[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const loadComments = async (taskId: string) => {
    if (commentsMap[taskId]) return
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    setCommentsMap(prev => ({ ...prev, [taskId]: (data as TaskComment[]) ?? [] }))
  }

  const toggleExpand = async (taskId: string) => {
    if (expandedId === taskId) {
      setExpandedId(null)
    } else {
      setExpandedId(taskId)
      await loadComments(taskId)
    }
  }

  const addComment = async (taskId: string, text: string, isAuto = false) => {
    const { data: newComment } = await supabase
      .from('task_comments')
      .insert({
        task_id:   taskId,
        user_id:   currentUserRef.current.id,
        comment:   text,
        is_auto:   isAuto,
        added_by:  currentUserRef.current.name,
      })
      .select()
      .single()
    if (newComment) {
      setCommentsMap(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] ?? []), newComment as TaskComment],
      }))
    }
  }

  const handleAddComment = async (taskId: string) => {
    const text = (commentInput[taskId] ?? '').trim()
    if (!text) return
    setSavingComment(taskId)
    await addComment(taskId, text)
    setCommentInput(prev => ({ ...prev, [taskId]: '' }))
    setSavingComment(null)
  }

  const handleQuickComment = async (taskId: string, text: string) => {
    setSavingComment(taskId)
    await addComment(taskId, text)
    setSavingComment(null)
  }

  const updateStatus = async (task: TaskWithClient, status: TaskStatus) => {
    const oldLabel = STATUS_OPTIONS.find(o => o.value === task.status)?.label ?? task.status
    const newLabel = STATUS_OPTIONS.find(o => o.value === status)?.label ?? status
    await supabase.from('tasks').update({ status }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t))
    // Auto-log
    if (commentsMap[task.id] !== undefined) {
      await addComment(task.id, `Status: ${oldLabel} → ${newLabel}`, true)
    } else {
      // Log silently even if panel not open
      await supabase.from('task_comments').insert({
        task_id:  task.id,
        user_id:  currentUserRef.current.id,
        comment:  `Status: ${oldLabel} → ${newLabel}`,
        is_auto:  true,
        added_by: currentUserRef.current.name,
      })
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekEnd   = new Date(today); weekEnd.setDate(today.getDate() + 7)
  const monthEnd  = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  // Apply quarter filter first, then date/status filter
  const quarterFiltered = quarterFilter
    ? tasks.filter(t => {
        const qf = QUARTER_FILTERS.find(q => q.id === quarterFilter)
        return qf?.match.some(m => t.period_label.includes(m)) ?? false
      })
    : tasks

  const filtered = quarterFiltered.filter(t => {
    const d = new Date(t.deadline)
    if (filter === 'overdue')   return d < today && t.status !== 'done'
    if (filter === 'thisweek')  return d >= today && d <= weekEnd
    if (filter === 'thismonth') return d >= today && d <= monthEnd
    if (filter === 'upcoming')  return d > monthEnd
    if (filter === 'done')      return t.status === 'done'
    return true
  })

  const overdueCount = tasks.filter(t => new Date(t.deadline) < today && t.status !== 'done').length

  // Quarter summary stats
  const qStats = quarterFilter ? {
    total:          quarterFiltered.length,
    done:           quarterFiltered.filter(t => t.status === 'done').length,
    in_progress:    quarterFiltered.filter(t => t.status === 'in_progress').length,
    info_requested: quarterFiltered.filter(t => t.status === 'info_requested').length,
    pending:        quarterFiltered.filter(t => t.status === 'pending').length,
  } : null

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const dayLabel = (iso: string) => {
    const d = new Date(iso); d.setHours(0,0,0,0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
    if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-600' }
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 font-bold' }
    if (diff <= 7)  return { text: `${diff}d`, cls: 'text-amber-600' }
    return { text: `${diff}d`, cls: 'text-gray-400' }
  }

  const DATE_FILTERS = [
    { id: 'all',       label: 'All' },
    { id: 'overdue',   label: `⚠ Overdue (${overdueCount})` },
    { id: 'thisweek',  label: 'This Week' },
    { id: 'thismonth', label: 'This Month' },
    { id: 'upcoming',  label: 'Upcoming' },
    { id: 'done',      label: 'Done' },
  ]

  return (
    <>
      {/* Quarter selector */}
      <div className="mb-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Period</p>
        <div className="flex gap-1.5 flex-wrap">
          {QUARTER_FILTERS.map(q => (
            <button key={q.id}
              onClick={() => setQuarterFilter(quarterFilter === q.id ? null : q.id)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-sm ${
                quarterFilter === q.id
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}>
              {q.label}
            </button>
          ))}
          {quarterFilter && (
            <button onClick={() => setQuarterFilter(null)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Quarter summary stats */}
      {qStats && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { label: 'Total',          val: qStats.total,          cls: 'bg-gray-50 text-gray-700' },
            { label: 'Done',           val: qStats.done,           cls: 'bg-green-50 text-green-700' },
            { label: 'In Progress',    val: qStats.in_progress,    cls: 'bg-amber-50 text-amber-700' },
            { label: 'Info Requested', val: qStats.info_requested, cls: 'bg-teal-50 text-teal-700' },
            { label: 'Pending',        val: qStats.pending,        cls: 'bg-gray-50 text-gray-500' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl px-3 py-2.5 text-center border border-gray-100 ${s.cls}`}>
              <div className="text-xl font-extrabold">{s.val}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Date / status filters */}
      <div className="mb-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Filter</p>
        <div className="flex gap-1.5 flex-wrap">
          {DATE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-sm ${
                filter === f.id
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
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
                {['Client','Task','Deadline','Status','Notes',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const dl       = dayLabel(t.deadline)
                const isOverdue = new Date(t.deadline) < today && t.status !== 'done'
                const isOpen   = expandedId === t.id
                const comments = commentsMap[t.id] ?? []
                const lastComment = [...comments].reverse().find(c => !c.is_auto)

                return (
                  <React.Fragment key={t.id}>
                    <tr
                      className={`border-b border-gray-50 hover:bg-teal-50/20 transition-colors cursor-pointer ${isOverdue ? 'bg-red-50/30' : ''} ${isOpen ? 'bg-teal-50/30' : ''}`}
                      onClick={() => toggleExpand(t.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 text-sm">{t.clients?.company_name ?? '—'}</div>
                        {t.clients?.assigned_to && (
                          <div className="text-[10px] text-gray-400">{t.clients.assigned_to}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{TASK_TYPE_LABELS[t.task_type]}</div>
                        <div className="text-xs text-gray-400">{t.period_label}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{fmtDate(t.deadline)}</div>
                        <div className={`text-xs font-semibold ${dl.cls}`}>{dl.text}</div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select
                          value={t.status}
                          onChange={e => updateStatus(t, e.target.value as TaskStatus)}
                          className={`border rounded-full text-xs font-bold py-1 pl-2.5 cursor-pointer transition-all hover:shadow-md ${statusCls(t.status)}`}
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        {lastComment
                          ? <span className="text-xs text-gray-500 truncate block">{lastComment.comment}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </td>
                    </tr>

                    {/* Expanded comment panel */}
                    {isOpen && (
                      <tr className="bg-teal-50/20">
                        <td colSpan={6} className="px-5 py-4 border-b border-teal-100">
                          {/* Comment history */}
                          <div className="mb-3">
                            {comments.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No comments yet. Add one below.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                                {comments.map(c => (
                                  <div key={c.id} className={`flex items-start gap-2 text-xs ${c.is_auto ? 'opacity-60' : ''}`}>
                                    <span className="text-gray-400 whitespace-nowrap flex-shrink-0">{fmtTime(c.created_at)}</span>
                                    <span className="font-semibold text-gray-600 flex-shrink-0">{c.added_by}</span>
                                    <span className={`text-gray-700 ${c.is_auto ? 'italic' : ''}`}>{c.comment}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quick presets */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {QUICK_COMMENTS.map(qc => (
                              <button key={qc}
                                disabled={savingComment === t.id}
                                onClick={() => handleQuickComment(t.id, qc)}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors">
                                {qc}
                              </button>
                            ))}
                          </div>

                          {/* Custom comment input */}
                          <div className="flex gap-2">
                            <input
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                              placeholder="Add a custom note…"
                              value={commentInput[t.id] ?? ''}
                              onChange={e => setCommentInput(prev => ({ ...prev, [t.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddComment(t.id) }}
                            />
                            <button
                              disabled={savingComment === t.id || !commentInput[t.id]?.trim()}
                              onClick={() => handleAddComment(t.id)}
                              className="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-teal-800 transition-colors">
                              {savingComment === t.id ? '…' : 'Add'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
    <AppLayout title="Tasks" subtitle="Your task overview">
      <Suspense fallback={<div className="text-gray-400 text-sm py-16 text-center">Loading tasks…</div>}>
        <TasksContent />
      </Suspense>
    </AppLayout>
  )
}
