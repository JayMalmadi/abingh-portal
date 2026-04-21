'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { generateTasksForClient, Client } from '@/lib/types'

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
    bookkeeping_freq: 'none' as 'monthly' | 'quarterly' | 'none',
    esl_freq: 'none' as 'monthly' | 'quarterly' | 'none',
    has_vat: false,
    has_cit: false,
    has_annual_accounts: false,
    email_cadence: 'monthly' as 'monthly' | 'quarterly',
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

    // Insert client
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

    // Auto-generate tasks for this client
    const tasks = generateTasksForClient(newClient as Client)
    if (tasks.length > 0) {
      await supabase.from('tasks').insert(tasks)
    }

    router.push('/clients')
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
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
            <Field label="Email Address">
              <input type="email" className={inputCls} value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="sophie@bedrijf.nl" />
            </Field>
            <Field label="Sector / Industry">
              <input className={inputCls} value={form.sector}
                onChange={e => set('sector', e.target.value)} placeholder="Food & Beverage" />
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
          <div className="flex gap-6 mt-4">
            {[
              { key: 'has_vat', label: 'VAT Return (quarterly)' },
              { key: 'has_cit', label: 'Corporate Income Tax (annual)' },
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
