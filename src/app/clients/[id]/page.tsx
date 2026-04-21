'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Client } from '@/lib/types'

const CLIENT_STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'inactive',   label: 'Inactive' },
  { value: 'on_hold',    label: 'On Hold' },
  { value: 'liquidated', label: 'Liquidated' },
]

export default function EditClientPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const supabase = createClient()
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState<Partial<Client>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('clients').select('*').eq('id', id).single()
      if (data) setForm(data as Client)
      setLoading(false)
    }
    load()
  }, [id])

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('clients').update(form).eq('id', id)
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/clients')
  }

  const handleDelete = async () => {
    if (!confirm('Delete this client? All their tasks will also be deleted.')) return
    await supabase.from('clients').delete().eq('id', id)
    router.push('/clients')
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
  const selectCls = `${inputCls} bg-white cursor-pointer`

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

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
                {CLIENT_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
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
          <p className="text-xs text-gray-400 mb-4">Configure where emails are sent for this client. Leave TO blank to use the contact email above.</p>
          <div className="grid grid-cols-1 gap-4">
            <Field
              label="TO (send to)"
              hint="Leave empty to automatically use the contact email above."
            >
              <input
                type="email"
                className={inputCls}
                value={form.email_to ?? ''}
                onChange={e => set('email_to', e.target.value)}
                placeholder={form.email ?? 'e.g. invoices@company.com'}
              />
            </Field>
            <Field
              label="CC (copy to)"
              hint="Separate multiple addresses with a comma: jan@abingh.com, amrit@abingh.com"
            >
              <input
                className={inputCls}
                value={form.email_cc ?? ''}
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
        <div className="card p-5 mb-5">
          <Field label="Notes">
            <textarea rows={3} className={inputCls} value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        <div className="flex items-center justify-between">
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
    </AppLayout>
  )
}
