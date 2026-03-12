import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { GeoffPosition, XenaAlphaSignal, Trade } from '../types'
import { StatCard } from '../components/StatCard'
import { TrendingUp, Activity, BarChart2, Zap } from 'lucide-react'

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
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GeoffTrading() {
  const [positions, setPositions] = useState<GeoffPosition[]>([])
  const [signals, setSignals] = useState<XenaAlphaSignal[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [posRes, sigRes, tradeRes] = await Promise.all([
          lifeos.from('geoff_positions').select('*').order('created_at', { ascending: false }),
          lifeos.from('xena_alpha_signals').select('*').order('score', { ascending: false }).limit(20),
          lifeos.from('trades').select('*').order('created_at', { ascending: false }).limit(20),
        ])
        if (posRes.error) throw new Error(`Positions: ${posRes.error.message}`)
        if (sigRes.error) throw new Error(`Signals: ${sigRes.error.message}`)
        if (tradeRes.error) throw new Error(`Trades: ${tradeRes.error.message}`)
        setPositions(posRes.data || [])
        setSignals(sigRes.data || [])
        setTrades(tradeRes.data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0)
  const strongSignals = signals.filter(s => s.signal_strength?.toUpperCase() === 'STRONG').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Loading GEOFF data...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <span className="text-xl">📈</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">GEOFF Trading</h2>
          <p className="text-gray-500 text-sm">Finance & Trading Operations</p>
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
          label="Open Positions"
          value={positions.length}
          icon={<Activity className="w-5 h-5" />}
          color="text-emerald-400"
        />
        <StatCard
          label="Total PnL"
          value={totalPnl !== 0 ? `$${totalPnl.toFixed(2)}` : '$0.00'}
          icon={<BarChart2 className="w-5 h-5" />}
          color={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatCard
          label="Total Signals"
          value={signals.length}
          icon={<Zap className="w-5 h-5" />}
          color="text-pink-400"
        />
        <StatCard
          label="Strong Signals"
          value={strongSignals}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-yellow-400"
        />
      </div>

      {/* Positions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Open Positions</h3>
          <p className="text-gray-500 text-xs mt-0.5">Current GEOFF positions</p>
        </div>
        {positions.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No open positions</p>
            <p className="text-gray-600 text-xs mt-1">GEOFF positions will appear here when active</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PnL</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {positions.map(pos => (
                  <tr key={pos.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4 text-white font-semibold text-sm">{pos.symbol || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        pos.side?.toLowerCase() === 'long'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {pos.side || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300 text-sm">{pos.size ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      {pos.entry_price != null ? `$${pos.entry_price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold text-sm ${(pos.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos.pnl != null ? `$${pos.pnl.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{pos.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alpha Signals as Opportunities */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Signal Opportunities</h3>
          <p className="text-gray-500 text-xs mt-0.5">Xena alpha signals sorted by score</p>
        </div>
        {signals.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No signals available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On-Chain</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {signals.map(sig => (
                  <tr key={sig.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4 text-white font-semibold text-sm">{sig.token_symbol}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${signalStrengthStyle(sig.signal_strength)}`}>
                        {sig.signal_strength}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-yellow-400 font-semibold text-sm">
                        {sig.score != null ? sig.score.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{sig.source_account || '—'}</td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      {sig.caller_win_rate != null ? `${(sig.caller_win_rate * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        sig.on_chain_confirmed
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-gray-700/50 text-gray-500'
                      }`}>
                        {sig.on_chain_confirmed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{formatDate(sig.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Trade History</h3>
          <p className="text-gray-500 text-xs mt-0.5">Recent closed trades</p>
        </div>
        {trades.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No trade history</p>
            <p className="text-gray-600 text-xs mt-1">Completed trades will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PnL</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {trades.map(trade => (
                  <tr key={trade.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4 text-white font-semibold text-sm">{trade.symbol || '—'}</td>
                    <td className="px-5 py-4 text-gray-300 text-sm">{trade.side || '—'}</td>
                    <td className="px-5 py-4 text-gray-300 text-sm">
                      {trade.price != null ? `$${trade.price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold text-sm ${(trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.pnl != null ? `$${trade.pnl.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{formatDate(trade.created_at)}</td>
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
