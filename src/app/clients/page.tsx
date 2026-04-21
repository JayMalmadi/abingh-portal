'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase'
import { Client } from '@/lib/types'

const AVATAR_COLORS = [
  '#f97316','#6366f1','#0ea5e9','#10b981',
  '#8b5cf6','#f59e0b','#2563eb','#ec4899','#14b8a6','#64748b',
]

function initials(name: string) {
  return name.split(' ').filter(w => /^[A-Z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

export default function ClientsPage() {
  const [clients, setClients]   = useState<Client[]>([])
  const [filtered, setFiltered] = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [overdueMap, setOverdueMap] = useState<Record<string, number>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('company_name', { ascending: true })
      const list = (clientsData as Client[]) ?? []
      setClients(list)
      setFiltered(list)

      // Count overdue tasks per client
      const today = new Date().toISOString().split('T')[0]
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('client_id')
        .lt('deadline', today)
        .neq('status', 'done')
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
    if (filter === 'monthly')   list = list.filter(c => c.bookkeeping_freq === 'monthly')
    if (filter === 'quarterly') list = list.filter(c => c.bookkeeping_freq === 'quarterly')
    if (filter === 'esl')       list = list.filter(c => c.esl_freq !== 'none')
    if (filter === 'overdue')   list = list.filter(c => overdueMap[c.id])
    if (search) list = list.filter(c => c.company_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    setFiltered(list)
  }, [filter, search, clients, overdueMap])

  const filters = [
    { id: 'all',       label: `All (${clients.length})` },
    { id: 'monthly',   label: 'Monthly BK' },
    { id: 'quarterly', label: 'Quarterly BK' },
    { id: 'esl',       label: 'ESL Filing' },
    { id: 'overdue',   label: 'Has Overdue' },
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
      actions={
        <Link href="/clients/new" className="btn-coral text-xs py-1.5 px-3 rounded-lg">+ Add Client</Link>
      }
    >
      {/* Filters + search */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-sm ${
                filter === f.id
                  ? 'bg-teal-700 text-white border-teal-700 shadow-teal-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-52"
        />
      </div>

      {/* Table */}
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
            <Link href="/clients/new" className="btn-coral text-sm py-2 px-4 rounded-lg inline-block">
              + Add First Client
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Company','Contact','Services','Cadence','Status',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const ov = overdueMap[c.id] ?? 0
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-teal-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
                          style={{ background: color }}
                        >
                          {initials(c.company_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{c.company_name}</div>
                          <div className="text-xs text-gray-400">{c.sector}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{c.contact_first} {c.contact_last}</div>
                      <div className="text-xs text-gray-400">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {serviceLabels(c).map(s => (
                          <span key={s} className="bg-gray-100 border border-gray-200 text-gray-500 text-[10.5px] px-1.5 py-0.5 rounded font-medium">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={c.email_cadence === 'monthly' ? 'badge-teal' : 'badge-purple'}>
                        {c.email_cadence === 'monthly' ? 'Monthly' : 'Quarterly'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ov > 0
                        ? <span className="badge-red">{ov} Overdue</span>
                        : <span className="badge-green">On Track</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="btn-outline text-xs py-1 px-2.5 rounded-lg"
                      >
                        Edit
                      </Link>
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
