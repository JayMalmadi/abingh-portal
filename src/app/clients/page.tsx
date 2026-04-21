'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Client, ClientStatus, EmailCadence, TEAM_MEMBERS } from '@/lib/types'

const AVATAR_COLORS = [
  '#f97316','#6366f1','#0ea5e9','#10b981',
  '#8b5cf6','#f59e0b','#2563eb','#ec4899','#14b8a6','#64748b',
]

const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string; cls: string }[] = [
  { value: 'active',     label: 'Active',     cls: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'inactive',   label: 'Inactive',   cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  { value: 'on_hold',    label: 'On Hold',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'liquidated', label: 'Liquidated', cls: 'bg-red-50 text-red-600 border-red-200' },
]

const CADENCE_OPTIONS: { value: EmailCadence; label: string; cls: string }[] = [
  { value: 'monthly',   label: 'Monthly',   cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'quarterly', label: 'Quarterly', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
]

function initials(name: string) {
  return name.split(' ').filter(w => /^[A-Z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const statusCls  = (s: ClientStatus)  => CLIENT_STATUS_OPTIONS.find(o => o.value === s)?.cls ?? ''
const cadenceCls = (c: EmailCadence)  => CADENCE_OPTIONS.find(o => o.value === c)?.cls ?? ''

function nameFromEmail(email: string) {
  const map: Record<string, string> = { 'jay@abingh.com': 'Jay' }
  return map[email] ?? email.split('@')[0]
}

export default function ClientsPage() {
  const [clients, setClients]       = useState<Client[]>([])
  const [filtered, setFiltered]     = useState<Client[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [overdueMap, setOverdueMap] = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string }>({ id: '', name: 'Jay' })
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      setCurrentUser({ id: user.id, name: nameFromEmail(user.email ?? '') })

      const { data: clientsData } = await supabase
        .from('clients').select('*').order('company_name', { ascending: true })
      const list = (clientsData as Client[]) ?? []
      setClients(list)
      setFiltered(list)

      const today = new Date().toISOString().split('T')[0]
      const { data: overdueTasks } = await supabase
        .from('tasks').select('client_id').lt('deadline', today).neq('status', 'done')
      const map: Record<string, number> = {}
      ;(overdueTasks ?? []).forEach((t: { client_id: string }) => {
        map[t.client_id] = (map[t.client_id] ?? 0) + 1
      })
      setOverdueMap(map)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let list = clients
    if (filter === 'monthly')    list = list.filter(c => c.bookkeeping_freq === 'monthly')
    if (filter === 'quarterly')  list = list.filter(c => c.bookkeeping_freq === 'quarterly')
    if (filter === 'esl')        list = list.filter(c => c.esl_freq !== 'none')
    if (filter === 'overdue')    list = list.filter(c => overdueMap[c.id])
    if (filter === 'active')     list = list.filter(c => (c.status ?? 'active') === 'active')
    if (filter === 'liquidated') list = list.filter(c => c.status === 'liquidated')
    if (search) list = list.filter(c =>
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(list)
  }, [filter, search, clients, overdueMap])

  const logInlineChange = async (clientId: string, field: string, oldVal: string, newVal: string) => {
    await supabase.from('client_audit_log').insert({
      client_id:  clientId,
      user_id:    currentUser.id,
      batch_id:   crypto.randomUUID(),
      action:     'updated',
      field_name: field,
      old_value:  oldVal,
      new_value:  newVal,
      changed_by: currentUser.name,
    })
  }

  const updateStatus = async (c: Client, status: ClientStatus) => {
    await supabase.from('clients').update({ status }).eq('id', c.id)
    await logInlineChange(c.id, 'Status', c.status ?? 'active', status)
    setClients(prev => prev.map(x => x.id === c.id ? { ...x, status } : x))
  }

  const updateCadence = async (c: Client, email_cadence: EmailCadence) => {
    await supabase.from('clients').update({ email_cadence }).eq('id', c.id)
    await logInlineChange(c.id, 'Email Cadence', c.email_cadence ?? 'quarterly', email_cadence)
    setClients(prev => prev.map(x => x.id === c.id ? { ...x, email_cadence } : x))
  }

  const updateAssigned = async (c: Client, assigned_to: string) => {
    await supabase.from('clients').update({ assigned_to }).eq('id', c.id)
    await logInlineChange(c.id, 'Assigned To', c.assigned_to ?? '', assigned_to)
    setClients(prev => prev.map(x => x.id === c.id ? { ...x, assigned_to } : x))
  }

  const filters = [
    { id: 'all',       label: `All (${clients.length})` },
    { id: 'active',    label: 'Active' },
    { id: 'monthly',   label: 'Monthly BK' },
    { id: 'quarterly', label: 'Quarterly BK' },
    { id: 'esl',       label: 'ESL Filing' },
    { id: 'overdue',   label: 'Has Overdue' },
    { id: 'liquidated',label: 'Liquidated' },
  ]

  const serviceLabels = (c: Client) => {
    const s = []
    if (c.bookkeeping_freq !== 'none') s.push(c.bookkeeping_freq === 'monthly' ? 'Monthly BK' : 'Quarterly BK')
    if (c.esl_freq !== 'none') s.push(c.esl_freq === 'monthly' ? 'Monthly ESL' : 'Quarterly ESL')
    if (c.has_vat) s.push('VAT')
    if (c.has_cit) s.push('CIT')
    if (c.has_annual_accounts) s.push('Annual Acc.')
    return s
  }

  return (
    <AppLayout
      title="Clients"
      subtitle={`${clients.length} total clients`}
      actions={<Link href="/clients/new" className="btn-coral text-xs py-1.5 px-3 rounded-lg">+ Add Client</Link>}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
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
        <input type="search" placeholder="Search clients…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-52" />
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-16 text-center">Loading clients…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🏢</div>
          <div className="text-gray-500 font-medium">No clients found</div>
          <div className="text-gray-400 text-sm mt-1 mb-4">
            {clients.length === 0 ? 'Add your first client to get started.' : 'Try adjusting your filters.'}
          </div>
          {clients.length === 0 && (
            <Link href="/clients/new" className="btn-coral text-sm py-2 px-4 rounded-lg inline-block">+ Add First Client</Link>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Company','Contact','Services','Cadence','Status','Assigned To',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const ov    = overdueMap[c.id] ?? 0
                const clientStatus = (c.status ?? 'active') as ClientStatus
                return (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-teal-50/20 transition-colors ${c.status === 'liquidated' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
                          style={{ background: color }}>
                          {initials(c.company_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{c.company_name}</div>
                          {ov > 0 && <span className="text-[10px] font-bold text-red-500">⚠ {ov} overdue</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{c.contact_first} {c.contact_last}</div>
                      <div className="text-xs text-gray-400">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {serviceLabels(c).length > 0
                          ? serviceLabels(c).map(s => (
                              <span key={s} className="bg-gray-100 border border-gray-200 text-gray-500 text-[10.5px] px-1.5 py-0.5 rounded font-medium">{s}</span>
                            ))
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select value={c.email_cadence ?? 'quarterly'}
                        onChange={e => updateCadence(c, e.target.value as EmailCadence)}
                        className={`border rounded-full text-xs font-bold py-1 pl-2.5 pr-1 cursor-pointer transition-all hover:shadow-md ${cadenceCls(c.email_cadence ?? 'quarterly')}`}>
                        {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={clientStatus}
                        onChange={e => updateStatus(c, e.target.value as ClientStatus)}
                        className={`border rounded-full text-xs font-bold py-1 pl-2.5 pr-1 cursor-pointer transition-all hover:shadow-md ${statusCls(clientStatus)}`}>
                        {CLIENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={c.assigned_to ?? 'Jay'}
                        onChange={e => updateAssigned(c, e.target.value)}
                        className="border border-gray-200 rounded-full text-xs font-bold py-1 pl-2.5 pr-1 cursor-pointer bg-white text-gray-700 hover:shadow-md transition-all">
                        {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="btn-outline text-xs py-1 px-2.5 rounded-lg">Edit</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
