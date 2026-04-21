'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Client, ClientAuditLog, Task, TaskStatus, TASK_TYPE_LABELS, STATUS_LABELS, TEAM_MEMBERS } from '@/lib/types'

const CLIENT_STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'inactive',   label: 'Inactive' },
  { value: 'on_hold',    label: 'On Hold' },
  { value: 'liquidated', label: 'Liquidated' },
]

// Human-readable field names for audit log display
const FIELD_LABELS: Record<string, string> = {
  company_name:        'Company Name',
  contact_first:       'First Name',
  contact_last:        'Last Name',
  email:               'Contact Email',
  sector:              'Sector',
  status:              'Status',
  assigned_to:         'Assigned To',
  bookkeeping_freq:    'Bookkeeping',
  esl_freq:            'ESL Filing',
  has_vat:             'VAT Return',
  has_cit:             'Corp. Income Tax',
  has_annual_accounts: 'Annual Accounts',
  email_cadence:       'Email Cadence',
  email_to:            'Email TO',
  email_cc:            'Email CC',
  notes:               'Notes',
}

// Tracked fields (order matters for display)
const TRACKED_FIELDS = Object.keys(FIELD_LABELS)

function formatValue(field: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  const maps: Record<string, Record<string, string>> = {
    bookkeeping_freq: { monthly: 'Monthly', quarterly: 'Quarterly', none: 'Not subscribed' },
    esl_freq:         { monthly: 'Monthly', quarterly: 'Quarterly', none: 'Not subscribed' },
    email_cadence:    { monthly: 'Monthly', quarterly: 'Quarterly' },
    status:           { active: 'Active', inactive: 'Inactive', on_hold: 'On Hold', liquidated: 'Liquidated' },
  }
  if (maps[field]) return maps[field][String(val)] ?? String(val)
  return String(val)
}

function nameFromEmail(email: string) {
  const map: Record<string, string> = { 'jay@abingh.com': 'Jay' }
  return map[email] ?? email.split('@')[0]
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Group audit log entries by batch_id
function groupBatches(logs: ClientAuditLog[]) {
  const map = new Map<string, ClientAuditLog[]>()
  for (const entry of logs) {
    const batch = map.get(entry.batch_id) ?? []
    batch.push(entry)
    map.set(entry.batch_id, batch)
  }
  // Sort batches newest first
  return Array.from(map.values()).sort(
    (a, b) => new Date(b[0].changed_at).getTime() - new Date(a[0].changed_at).getTime()
  )
}

export default function EditClientPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const supabase = createClient()

  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState<Partial<Client>>({})
  const [auditLogs, setAuditLogs] = useState<ClientAuditLog[]>([])
  const [showLog, setShowLog]     = useState(false)
  const [tasks, setTasks]         = useState<Task[]>([])
  const [showTasks, setShowTasks] = useState(true)
  const originalRef               = useRef<Partial<Client>>({})
  const currentUserRef            = useRef<{ id: string; name: string }>({ id: '', name: 'Jay' })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      currentUserRef.current = { id: user.id, name: nameFromEmail(user.email ?? '') }

      const { data } = await supabase.from('clients').select('*').eq('id', id).single()
      if (data) {
        setForm(data as Client)
        originalRef.current = { ...(data as Client) }
      }

      // Load audit log
      const { data: logs } = await supabase
        .from('client_audit_log')
        .select('*')
        .eq('client_id', id)
        .order('changed_at', { ascending: false })
        .limit(200)
      setAuditLogs((logs as ClientAuditLog[]) ?? [])

      // Load tasks for this client
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', id)
        .order('deadline', { ascending: true })
      setTasks((taskData as Task[]) ?? [])

      setLoading(false)
    }
    load()
  }, [id])

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Compute diffs
    const original = originalRef.current
    const changes: { field_name: string; old_value: string; new_value: string }[] = []
    for (const field of TRACKED_FIELDS) {
      const oldVal = original[field as keyof Client]
      const newVal = form[field as keyof Client]
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({
          field_name: FIELD_LABELS[field] ?? field,
          old_value:  formatValue(field, oldVal),
          new_value:  formatValue(field, newVal),
        })
      }
    }

    // Save client
    const { error: saveError } = await supabase.from('clients').update(form).eq('id', id)
    if (saveError) { setError(saveError.message); setSaving(false); return }

    // Insert audit log entries
    if (changes.length > 0) {
      const batchId = crypto.randomUUID()
      const { data: { session } } = await supabase.auth.getSession()
      const entries = changes.map(c => ({
        client_id:  id,
        user_id:    currentUserRef.current.id || session?.user?.id,
        batch_id:   batchId,
        action:     'updated',
        field_name: c.field_name,
        old_value:  c.old_value,
        new_value:  c.new_value,
        changed_by: currentUserRef.current.name,
      }))
      const { data: newLogs } = await supabase.from('client_audit_log').insert(entries).select()
      if (newLogs) {
        setAuditLogs(prev => [...(newLogs as ClientAuditLog[]), ...prev])
      }
    }

    // Update original ref
    originalRef.current = { ...form }
    setSaving(false)
    router.push('/clients')
  }

  const handleDelete = async () => {
    if (!confirm('Delete this client? All their tasks will also be deleted.')) return
    await supabase.from('clients').delete().eq('id', id)
    router.push('/clients')
  }

  const handleTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const inputCls  = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
  const selectCls = `${inputCls} bg-white cursor-pointer`

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

  const batches = groupBatches(auditLogs)

  if (loading) return <AppLayout title="Edit Client"><div className="text-gray-400 text-sm py-16 text-center">Loading…</div></AppLayout>

  return (
    <AppLayout
      title={form.company_name ?? 'Edit Client'}
      subtitle="Update client details"
      actions={<Link href="/clients" className="btn-outline text-xs py-1.5 px-3 rounded-lg">← Back</Link>}
    >
      <form onSubmit={handleSubmit} className="max-w-2xl">

        {/* Company Details */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Company Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Company Name *">
                <input required className={inputCls} value={form.company_name ?? ''}
                  onChange={e => set('company_name', e.target.value)} />
              </Field>
            </div>
            <Field label="Contact First Name">
              <input className={inputCls} value={form.contact_first ?? ''}
                onChange={e => set('contact_first', e.target.value)} />
            </Field>
            <Field label="Contact Last Name">
              <input className={inputCls} value={form.contact_last ?? ''}
                onChange={e => set('contact_last', e.target.value)} />
            </Field>
            <Field label="Contact Email">
              <input type="email" className={inputCls} value={form.email ?? ''}
                onChange={e => set('email', e.target.value)} />
            </Field>
            <Field label="Client Status">
              <select className={selectCls} value={form.status ?? 'active'}
                onChange={e => set('status', e.target.value)}>
                {CLIENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Assigned To">
              <select className={selectCls} value={form.assigned_to ?? 'Jay'}
                onChange={e => set('assigned_to', e.target.value)}>
                {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Sector">
              <input className={inputCls} value={form.sector ?? ''}
                onChange={e => set('sector', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Email Settings */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">📧 Email Settings</h2>
          <p className="text-xs text-gray-400 mb-4">Leave TO blank to use the contact email above.</p>
          <div className="grid grid-cols-1 gap-4">
            <Field label="TO (send to)" hint="Leave empty to use the contact email above.">
              <input type="email" className={inputCls} value={form.email_to ?? ''}
                onChange={e => set('email_to', e.target.value)}
                placeholder={form.email ?? 'e.g. invoices@company.com'} />
            </Field>
            <Field label="CC (copy to)" hint="Separate multiple addresses with a comma.">
              <input className={inputCls} value={form.email_cc ?? ''}
                onChange={e => set('email_cc', e.target.value)}
                placeholder="e.g. jay@abingh.com, amrit@abingh.com" />
            </Field>
          </div>
        </div>

        {/* Services */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Services</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bookkeeping">
              <select className={selectCls} value={form.bookkeeping_freq ?? 'none'}
                onChange={e => set('bookkeeping_freq', e.target.value)}>
                <option value="none">Not subscribed</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>
            <Field label="ESL Filing">
              <select className={selectCls} value={form.esl_freq ?? 'none'}
                onChange={e => set('esl_freq', e.target.value)}>
                <option value="none">Not subscribed</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>
            <Field label="Email Cadence">
              <select className={selectCls} value={form.email_cadence ?? 'quarterly'}
                onChange={e => set('email_cadence', e.target.value)}>
                <option value="monthly">Monthly info requests</option>
                <option value="quarterly">Quarterly info requests</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 mt-4">
            {[
              { key: 'has_vat',             label: 'VAT Return' },
              { key: 'has_cit',             label: 'Corporate Income Tax' },
              { key: 'has_annual_accounts', label: 'Annual Accounts' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded accent-teal-600"
                  checked={!!form[key as keyof Client]}
                  onChange={e => set(key, e.target.checked)} />
                <span className="text-sm text-gray-700 font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5 mb-4">
          <Field label="Notes">
            <textarea rows={3} className={inputCls} value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-coral py-2.5 px-6 rounded-lg">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/clients" className="btn-outline py-2.5 px-5 rounded-lg">Cancel</Link>
          </div>
          <button type="button" onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm font-semibold transition-colors">
            Delete Client
          </button>
        </div>
      </form>

      {/* Tasks Panel */}
      <div className="max-w-2xl mb-4">
        <button
          type="button"
          onClick={() => setShowTasks(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>📋 Tasks ({tasks.length})</span>
          <span className="text-gray-400">{showTasks ? '▲' : '▼'}</span>
        </button>

        {showTasks && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
            {tasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No tasks found for this client.</div>
            ) : (
              <>
                {/* Group by year/quarter for readability */}
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const STATUS_COLOR: Record<TaskStatus, string> = {
                    pending:        'bg-gray-100 text-gray-600',
                    info_requested: 'bg-teal-50 text-teal-700',
                    in_progress:    'bg-amber-50 text-amber-700',
                    done:           'bg-green-50 text-green-700',
                  }
                  const open  = tasks.filter(t => t.status !== 'done')
                  const done  = tasks.filter(t => t.status === 'done')

                  const TaskLine = ({ t }: { t: Task }) => {
                    const deadline = new Date(t.deadline)
                    const isOverdue = deadline < today && t.status !== 'done'
                    const diff = Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
                    const dateLabel = isOverdue
                      ? `${Math.abs(diff)}d overdue`
                      : diff === 0 ? 'Today' : `${diff}d`

                    return (
                      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{TASK_TYPE_LABELS[t.task_type]}</span>
                          <span className="text-gray-400 text-xs ml-2">{t.period_label}</span>
                        </div>
                        <span className={`text-[11px] font-bold whitespace-nowrap ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                          {deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          {' ·'} {dateLabel}
                        </span>
                        <select
                          value={t.status}
                          onChange={e => handleTaskStatus(t.id, e.target.value as TaskStatus)}
                          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-400 ${STATUS_COLOR[t.status]}`}
                        >
                          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }

                  return (
                    <div className="max-h-[500px] overflow-y-auto">
                      {open.length > 0 && (
                        <div>
                          <div className="px-4 py-1.5 bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                            Open — {open.length} task{open.length !== 1 ? 's' : ''}
                          </div>
                          {open.map(t => <TaskLine key={t.id} t={t} />)}
                        </div>
                      )}
                      {done.length > 0 && (
                        <div>
                          <div className="px-4 py-1.5 bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                            Completed — {done.length}
                          </div>
                          {done.map(t => <TaskLine key={t.id} t={t} />)}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="max-w-2xl">
        <button
          type="button"
          onClick={() => setShowLog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>🕓 Change History ({batches.length} {batches.length === 1 ? 'entry' : 'entries'})</span>
          <span className="text-gray-400">{showLog ? '▲' : '▼'}</span>
        </button>

        {showLog && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
            {batches.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No changes recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {batches.map((batch, bi) => {
                  const first = batch[0]
                  return (
                    <div key={bi} className="px-5 py-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[10px] font-extrabold flex-shrink-0">
                          {first.changed_by?.[0] ?? '?'}
                        </div>
                        <span className="text-xs font-bold text-gray-700">{first.changed_by}</span>
                        <span className="text-xs text-gray-400">· {fmtDateTime(first.changed_at)}</span>
                      </div>
                      {batch.map((entry, ei) => (
                        <div key={ei} className="ml-8 text-xs text-gray-600 mb-1">
                          {entry.action === 'created' ? (
                            <span className="text-teal-600 font-semibold">✦ Client created</span>
                          ) : (
                            <>
                              <span className="font-semibold text-gray-700">{entry.field_name}:</span>
                              {' '}
                              <span className="line-through text-gray-400">{entry.old_value}</span>
                              {' → '}
                              <span className="text-gray-800 font-medium">{entry.new_value}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
