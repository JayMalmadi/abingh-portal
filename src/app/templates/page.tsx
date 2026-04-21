'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { EmailTemplate } from '@/lib/types'

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Monthly Info Request',
    cadence: 'monthly',
    subject: 'Bookkeeping {{MonthName}} {{Year}} – Documents Required – {{CompanyName}}',
    body: `Dear {{ContactFirstName}},

I hope you're doing well!

We want to process the bookkeeping for {{MonthName}} {{Year}}, and I would kindly request that you provide the following documents and information:

1. Sales Invoices
2. Purchase Invoices
3. Bank Statements in MT40 format (if available)
4. Bank Statements in PDF format
5. Bank Statements in CSV format
6. Any additional documentation or information relevant to the administration (e.g., credit notes, receipts, etc.).

Please don't hesitate to reach out if you have any questions or need assistance gathering the required documents.

I would appreciate receiving the documents by {{DeadlineDate}} to ensure a timely and accurate processing.

Kind regards,
{{SenderName}}
Abingh Accountancy`,
  },
  {
    name: 'Quarterly Info Request',
    cadence: 'quarterly',
    subject: 'Bookkeeping & VAT {{QuarterName}} {{Year}} – Documents Required – {{CompanyName}}',
    body: `Dear {{ContactFirstName}},

I hope you're doing well!

We want to process the bookkeeping and file VAT for {{QuarterName}} {{Year}}, and I would kindly request that you provide the following documents and information:

1. Sales Invoices
2. Purchase Invoices
3. Tax assessments
4. Bank Statements in MT40 format (if available)
5. Bank Statements in PDF format
6. Bank Statements in CSV format
7. Any additional documentation or information relevant to the administration (e.g., credit notes, import/export statements, etc.).

Please don't hesitate to reach out if you have any questions or need assistance gathering the required documents.

I would appreciate receiving the documents by {{DeadlineDate}} to ensure a timely and accurate processing.

Kind regards,
{{SenderName}}
Abingh Accountancy`,
  },
]

const PLACEHOLDERS = [
  '{{ContactFirstName}}', '{{CompanyName}}', '{{MonthName}}', '{{Year}}',
  '{{QuarterName}}', '{{QuarterMonths}}', '{{DeadlineDate}}', '{{SenderName}}',
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [editing, setEditing]     = useState<EmailTemplate | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .order('cadence', { ascending: true })

      if (!data || data.length === 0) {
        // Seed default templates on first visit
        const { data: seeded } = await supabase
          .from('email_templates')
          .insert(DEFAULT_TEMPLATES.map(t => ({ ...t, user_id: user.id })))
          .select()
        setTemplates((seeded as EmailTemplate[]) ?? [])
      } else {
        setTemplates(data as EmailTemplate[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    await supabase.from('email_templates')
      .update({ subject: editing.subject, body: editing.body, name: editing.name })
      .eq('id', editing.id)
    setTemplates(prev => prev.map(t => t.id === editing.id ? editing : t))
    setEditing(null)
    setSaving(false)
  }

  const renderBody = (body: string) => {
    let html = body
    PLACEHOLDERS.forEach(p => {
      html = html.replaceAll(p, `<span class="ph">${p}</span>`)
    })
    return html
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"

  return (
    <AppLayout
      title="Email Templates"
      subtitle="Edit the templates sent to your clients automatically"
    >
      <style>{`.ph { background:#ccfbf1; color:#0f766e; padding:1px 5px; border-radius:4px; font-weight:700; font-size:11px; }`}</style>

      {/* Placeholder reference */}
      <div className="card p-4 mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Available Placeholders</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(p => (
            <code key={p} className="bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-bold px-2 py-0.5 rounded">{p}</code>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">These are replaced automatically with real values when an email is sent.</p>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">Loading templates…</div>
      ) : (
        <div className="space-y-5">
          {templates.map(t => (
            <div key={t.id} className="card overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 border-b border-gray-100 px-5 py-3.5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {t.cadence === 'monthly' ? '📅' : '📋'} {t.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.cadence === 'monthly'
                      ? 'Sent on the 1st of each month to monthly-cadence clients'
                      : 'Sent on the 1st of the month after each quarter-end'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditing(editing?.id === t.id ? null : { ...t })}
                    className="btn-outline text-xs py-1.5 px-3 rounded-lg"
                  >
                    {editing?.id === t.id ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    className="btn-coral text-xs py-1.5 px-3 rounded-lg opacity-60 cursor-not-allowed"
                    title="Email sending via Microsoft 365 — coming in the next update"
                  >
                    ✉ Send (coming soon)
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                {editing?.id === t.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Template Name</label>
                      <input className={inputCls} value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Subject Line</label>
                      <input className={inputCls} value={editing.subject}
                        onChange={e => setEditing({ ...editing, subject: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Body</label>
                      <textarea rows={14} className={inputCls} value={editing.body}
                        onChange={e => setEditing({ ...editing, body: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving} className="btn-coral text-xs py-1.5 px-4 rounded-lg">
                        {saving ? 'Saving…' : 'Save Template'}
                      </button>
                      <button onClick={() => setEditing(null)} className="btn-outline text-xs py-1.5 px-3 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3">
                      <strong>Subject:</strong> <span className="text-gray-700">{t.subject}</span>
                    </p>
                    <div
                      className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 border border-gray-100 rounded-lg p-4"
                      dangerouslySetInnerHTML={{ __html: renderBody(t.body) }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email sending info box */}
      <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl p-4">
        <p className="text-sm font-bold text-teal-800 mb-1">📬 Email Sending via Microsoft 365</p>
        <p className="text-xs text-teal-700">
          Sending emails through your Outlook account (jay@abingh.com) requires a one-time Microsoft Azure setup.
          This is the next step after your initial deployment — I&apos;ll walk you through it step by step.
        </p>
      </div>
    </AppLayout>
  )
}
