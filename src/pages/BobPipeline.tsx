import { useEffect, useState } from 'react'
import { ovb } from '../lib/supabase'
import type { Estimate } from '../types'
import { StatCard } from '../components/StatCard'
import { ClientDrawer } from '../components/ClientDrawer'
import { DollarSign, FileText, CheckCircle, Clock, ChevronRight, Search } from 'lucide-react'

function statusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case 'draft': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    case 'sent': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function statusDot(status: string) {
  switch (status?.toLowerCase()) {
    case 'draft': return 'bg-gray-500'
    case 'sent': return 'bg-blue-500'
    case 'approved': return 'bg-emerald-500'
    case 'rejected': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'approved' | 'rejected'

export function BobPipeline() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await ovb
          .from('estimates')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw new Error(error.message)
        setEstimates(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const active = estimates.filter(e => !e.is_archived && e.status !== 'rejected')
  const totalPipeline = active.reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedValue = estimates
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.total || 0), 0)

  const filtered = estimates.filter(e => {
    const matchSearch = !search || e.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.project_category?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || e.status?.toLowerCase() === statusFilter
    return matchSearch && matchStatus
  })

  const statusCounts = {
    draft: estimates.filter(e => e.status === 'draft').length,
    sent: estimates.filter(e => e.status === 'sent').length,
    approved: estimates.filter(e => e.status === 'approved').length,
    rejected: estimates.filter(e => e.status === 'rejected').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Loading pipeline...
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <span className="text-xl">🔧</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Bob Pipeline</h2>
            <p className="text-gray-500 text-sm">OVB Construction — click any row to open client folder</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Estimates" value={estimates.length} icon={<FileText className="w-5 h-5" />} color="text-white" />
          <StatCard label="Active Pipeline" value={active.length} icon={<Clock className="w-5 h-5" />} color="text-blue-400" />
          <StatCard label="Approved Value" value={`$${approvedValue.toLocaleString()}`} icon={<CheckCircle className="w-5 h-5" />} color="text-emerald-400" />
          <StatCard label="Total Pipeline" value={`$${totalPipeline.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="text-yellow-400" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'draft', 'sent', 'approved', 'rejected'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s)}`} />}
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && <span className="opacity-60 ml-0.5">({statusCounts[s as keyof typeof statusCounts]})</span>}
            </button>
          ))}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 ml-auto">
            <Search className="w-3.5 h-3.5 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none w-32"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Estimates</h3>
            <p className="text-gray-500 text-xs mt-0.5">{filtered.length} of {estimates.length} — click to open client folder</p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No estimates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract</th>
                    <th className="px-1 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map(estimate => (
                    <tr
                      key={estimate.id}
                      onClick={() => setSelectedId(estimate.id)}
                      className={`hover:bg-gray-800/50 transition-colors cursor-pointer group ${
                        selectedId === estimate.id ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="text-white font-medium text-sm group-hover:text-blue-300 transition-colors">
                          {estimate.customer_name}
                        </div>
                        {estimate.customer_email && (
                          <div className="text-gray-600 text-xs mt-0.5">{estimate.customer_email}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-gray-400 text-sm">{estimate.project_category || '—'}</div>
                        {estimate.project_address && (
                          <div className="text-gray-600 text-xs mt-0.5 truncate max-w-[160px]">{estimate.project_address}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-white font-semibold text-sm">
                          {estimate.total != null ? `$${Number(estimate.total).toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle(estimate.status)}`}>
                          {estimate.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-gray-500 text-xs">{formatDate(estimate.created_at)}</span>
                      </td>
                      <td className="px-5 py-4">
                        {estimate.contract_signed ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ClientDrawer estimateId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  )
}
