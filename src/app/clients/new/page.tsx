'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { generateTasksForClient, Client, TEAM_MEMBERS } from '@/lib/types'

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    company_name: '',
    contact_first: '',
    contact_last: '',
    email: '',
    sector: '',
    status: 'active' as 'active' | 'inactive' | 'on_hold' | 'liquidated',
    assigned_to: 'Jay',
    bookkeeping_freq: 'none' as 'monthly' | 'quarterly' | 'none',
    esl_freq: 'none' as 'monthly' | 'quarterly' | 'none',
    has_vat: false,
    has_cit: false,
    has_annual_accounts: false,
    email_cadence: 'quarterly' as 'monthly' | 'quarterly',
    email_to: '',
    email_cc: '',
    notes: '',
  })

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ ...form, user_id: user.id })
      .select()
      .single()

    if (clientError) {
      setError(clientError.message)
      setSaving(false)
      return
    }

    const tasks = generateTasksForClient(newClient as Client)
    if (tasks.length > 0) {
      await supabase.from('tasks').insert(tasks)
    }

    // Log creation
    await supabase.from('client_audit_log').insert({
      client_id:  newClient.id,
      user_id:    user.id,
      batch_id:   crypto.randomUUID(),
      action:     'created',
      changed_by: 'Jay',
    })

    router.push('/clients')
  }

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
  const selectCls = `${inputCls} bg-white cursor-pointer`

  return (
    <AppLayout
      title="Add New Client"
      subtitle="Fill in the client details and their services"
      actions={
        <Link href="/clients" className="btn-outline text-xs py-1.5 px-3 rounded-lg">← Back to Clients</Link>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-2xl">

        {/* Company info */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Company Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Company Name *">
                <input required className={inputCls} value={form.company_name}
                  onChange={e => set('company_name', e.target.value)} placeholder="Bakkerij De Gouden Korst BV" />
              </Field>
            </div>
            <Field label="Contact First Name">
              <input className={inputCls} value={form.contact_first}
                onChange={e => set('contact_first', e.target.value)} placeholder="Sophie" />
            </Field>
            <Field label="Contact Last Name">
              <input className={inputCls} value={form.contact_last}
                onChange={e => set('contact_last', e.target.value)} placeholder="van den Berg" />
            </Field>
            <Field label="Contact Email">
              <input type="email" className={inputCls} value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="sophie@bedrijf.nl" />
            </Field>
            <Field label="Client Status">
              <select className={selectCls} value={form.status}
                onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_hold">On Hold</option>
                <option value="liquidated">Liquidated</option>
              </select>
            </Field>
            <Field label="Assigned To">
              <select className={selectCls} value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}>
                {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Sector / Industry">
              <input className={inputCls} value={form.sector}
                onChange={e => set('sector', e.target.value)} placeholder="Food & Beverage" />
            </Field>
          </div>
        </div>

        {/* Email Settings */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">📧 Email Settings</h2>
          <p className="text-xs text-gray-400 mb-4">Configure where automated emails are sent. Leave TO blank to use the contact email above.</p>
          <div className="grid grid-cols-1 gap-4">
            <Field
              label="TO (send to)"
              hint="Leave empty to use the contact email above."
            >
              <input
                type="email"
                className={inputCls}
                value={form.email_to}
                onChange={e => set('email_to', e.target.value)}
                placeholder="e.g. invoices@company.com"
              />
            </Field>
            <Field
              label="CC (copy to)"
              hint="Separate multiple addresses with a comma: jay@abingh.com, amrit@abingh.com"
            >
              <input
                className={inputCls}
                value={form.email_cc}
                onChange={e => set('email_cc', e.target.value)}
                placeholder="e.g. jay@abingh.com, amrit@abingh.com"
              />
            </Field>
          </div>
        </div>

        {/* Services */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Services</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bookkeeping">
              <select className={selectCls} value={form.bookkeeping_freq}
                onChange={e => set('bookkeeping_freq', e.target.value)}>
                <option value="none">Not subscribed</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>
            <Field label="ESL Filing">
              <select className={selectCls} value={form.esl_freq}
                onChange={e => set('esl_freq', e.target.value)}>
                <option value="none">Not subscribed</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>
            <Field label="Email Cadence">
              <select className={selectCls} value={form.email_cadence}
                onChange={e => set('email_cadence', e.target.value)}>
                <option value="monthly">Monthly info requests</option>
                <option value="quarterly">Quarterly info requests</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 mt-4">
            {[
              { key: 'has_vat',             label: 'VAT Return (quarterly)' },
              { key: 'has_cit',             label: 'Corporate Income Tax (annual)' },
              { key: 'has_annual_accounts', label: 'Annual Accounts' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded accent-teal-600"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={e => set(key, e.target.checked)} />
                <span className="text-sm text-gray-700 font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5 mb-5">
          <Field label="Notes (optional)">
            <textarea rows={3} className={inputCls} value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any extra notes about this client…" />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-coral py-2.5 px-6 rounded-lg">
            {saving ? 'Saving…' : 'Save Client & Generate Tasks'}
          </button>
          <Link href="/clients" className="btn-outline py-2.5 px-5 rounded-lg">Cancel</Link>
        </div>
      </form>
    </AppLayout>
  )
}
