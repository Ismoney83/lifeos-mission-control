import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { XenaAlphaSignal } from '../types'
import { StatCard } from '../components/StatCard'
import { Zap, TrendingUp, CheckCircle, Filter } from 'lucide-react'

function signalStrengthStyle(strength: string) {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'WEAK': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type StrengthFilter = 'ALL' | 'STRONG' | 'MEDIUM' | 'WEAK'

export function XenaSignals() {
  const [signals, setSignals] = useState<XenaAlphaSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StrengthFilter>('ALL')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await lifeos
          .from('xena_alpha_signals')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw new Error(error.message)
        setSignals(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = filter === 'ALL'
    ? signals
    : signals.filter(s => s.signal_strength?.toUpperCase() === filter)

  const strongCount = signals.filter(s => s.signal_strength?.toUpperCase() === 'STRONG').length
  const confirmedCount = signals.filter(s => s.on_chain_confirmed).length
  const avgScore = signals.length > 0
    ? signals.reduce((sum, s) => sum + (s.score || 0), 0) / signals.length
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          Loading Xena signals...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
          <span className="text-xl">🎯</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Xena Signals</h2>
          <p className="text-gray-500 text-sm">Alpha Signal Intelligence</p>
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
          label="Total Signals"
          value={signals.length}
          icon={<Zap className="w-5 h-5" />}
          color="text-pink-400"
        />
        <StatCard
          label="Strong Signals"
          value={strongCount}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-emerald-400"
        />
        <StatCard
          label="On-Chain Confirmed"
          value={confirmedCount}
          icon={<CheckCircle className="w-5 h-5" />}
          color="text-blue-400"
        />
        <StatCard
          label="Avg Score"
          value={avgScore.toFixed(1)}
          icon={<Filter className="w-5 h-5" />}
          color="text-yellow-400"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm mr-2">Filter:</span>
        {(['ALL', 'STRONG', 'MEDIUM', 'WEAK'] as StrengthFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? f === 'ALL'
                  ? 'bg-pink-500 text-white'
                  : f === 'STRONG'
                  ? 'bg-emerald-500 text-white'
                  : f === 'MEDIUM'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f} {f !== 'ALL' && `(${signals.filter(s => s.signal_strength?.toUpperCase() === f).length})`}
          </button>
        ))}
      </div>

      {/* Signals Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Alpha Signals</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Showing {filtered.length} of {signals.length} signals
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No signals found</p>
            <p className="text-gray-600 text-xs mt-1">
              {filter !== 'ALL' ? `No ${filter} signals available` : 'Xena will post signals as she discovers them'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On-Chain</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GEOFF</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(sig => (
                  <tr key={sig.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-white font-bold text-sm">{sig.token_symbol}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${signalStrengthStyle(sig.signal_strength)}`}>
                        {sig.signal_strength}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{sig.signal_type || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 font-semibold text-sm">
                          {sig.score != null ? sig.score.toFixed(1) : '—'}
                        </span>
                        {sig.score != null && (
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-emerald-500 rounded-full"
                              style={{ width: `${Math.min((sig.score / 10) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{sig.source_account || '—'}</td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      {sig.caller_win_rate != null
                        ? `${(sig.caller_win_rate * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`w-2 h-2 rounded-full inline-block ${sig.on_chain_confirmed ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`w-2 h-2 rounded-full inline-block ${sig.geoff_reviewed ? 'bg-purple-400' : 'bg-gray-600'}`} />
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(sig.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Post Content Preview */}
      {filtered.some(s => s.post_content) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Signal Posts</h3>
            <p className="text-gray-500 text-xs mt-0.5">Source content for signals</p>
          </div>
          <div className="divide-y divide-gray-800">
            {filtered.filter(s => s.post_content).slice(0, 5).map(sig => (
              <div key={sig.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-semibold text-sm">{sig.token_symbol}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${signalStrengthStyle(sig.signal_strength)}`}>
                    {sig.signal_strength}
                  </span>
                  <span className="text-gray-600 text-xs ml-auto">{sig.source_account}</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
                  {sig.post_content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
