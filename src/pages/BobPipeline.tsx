import { useEffect, useState } from 'react'
import { ovb } from '../lib/supabase'
import type { Estimate } from '../types'
import { StatCard } from '../components/StatCard'
import { DollarSign, FileText, CheckCircle, Clock } from 'lucide-react'

function statusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case 'draft': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    case 'sent': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function BobPipeline() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const activeEstimates = estimates.filter(e => !e.is_archived && e.status !== 'rejected')
  const totalPipeline = activeEstimates.reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedValue = estimates
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.total || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Loading Bob Pipeline...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <span className="text-xl">🔧</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Bob Pipeline</h2>
          <p className="text-gray-500 text-sm">OVB Construction Estimates</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          Error: {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Estimates"
          value={estimates.length}
          icon={<FileText className="w-5 h-5" />}
          color="text-white"
        />
        <StatCard
          label="Active"
          value={activeEstimates.length}
          icon={<Clock className="w-5 h-5" />}
          color="text-blue-400"
        />
        <StatCard
          label="Approved Value"
          value={`$${approvedValue.toLocaleString()}`}
          icon={<CheckCircle className="w-5 h-5" />}
          color="text-emerald-400"
        />
        <StatCard
          label="Total Pipeline"
          value={`$${totalPipeline.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="text-yellow-400"
        />
      </div>

      {/* Estimates Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">All Estimates</h3>
          <p className="text-gray-500 text-xs mt-0.5">Ordered by most recent</p>
        </div>

        {estimates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No estimates yet</p>
            <p className="text-gray-600 text-xs mt-1">Estimates created by Bob will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {estimates.map(estimate => (
                  <tr key={estimate.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-white font-medium text-sm">{estimate.customer_name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-400 text-sm">{estimate.project_category || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-300 text-sm">
                        {estimate.subtotal != null ? `$${Number(estimate.subtotal).toLocaleString()}` : '—'}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
