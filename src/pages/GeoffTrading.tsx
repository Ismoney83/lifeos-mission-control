import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { GeoffPosition, XenaAlphaSignal, Trade, GeoffPMTrade } from '../types'
import { StatCard } from '../components/StatCard'
import { GeoffChart } from '../components/GeoffChart'
import {
  TrendingUp, Activity, BarChart2, Zap, CheckCircle, XCircle,
  Terminal, Send, ExternalLink, RefreshCw, AlertTriangle,
  DollarSign, Target, BookOpen
} from 'lucide-react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, CartesianGrid
} from 'recharts'

type Tab = 'chart' | 'overview' | 'positions' | 'signals' | 'history' | 'strategies' | 'control'

interface BacktestResult {
  id: string
  strategy_name: string
  win_rate: number
  total_trades: number
  winning_trades: number
  avg_profit_pct: number | null
  total_return_pct: number | null
  verdict: string | null
  created_at: string
}

function signalBadge(strength: string) {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'WEAK': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function actionBadge(action: string | null) {
  switch (action?.toUpperCase()) {
    case 'APPROVED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'REJECTED': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'WATCHING': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    default: return 'text-gray-500 bg-gray-700/20 border-gray-700/30'
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const QUICK_COMMANDS = [
  { label: 'Scan Alpha', cmd: 'GEOFF: scan for new alpha signals now' },
  { label: 'Check Positions', cmd: 'GEOFF: report all open positions and current PnL' },
  { label: 'Risk Check', cmd: 'GEOFF: run full risk assessment on current portfolio' },
  { label: 'Market Scan', cmd: 'GEOFF: scan Kalshi for high-value prediction markets' },
  { label: 'Pause Trading', cmd: 'GEOFF: pause all new position entries until further notice' },
  { label: 'Resume Trading', cmd: 'GEOFF: resume normal trading operations' },
]

export function GeoffTrading() {
  const [tab, setTab] = useState<Tab>('chart')
  const [positions, setPositions] = useState<GeoffPosition[]>([])
  const [signals, setSignals] = useState<XenaAlphaSignal[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [pmTrades, setPmTrades] = useState<GeoffPMTrade[]>([])
  const [backtest, setBacktest] = useState<BacktestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [cmdSending, setCmdSending] = useState(false)
  const [cmdLog, setCmdLog] = useState<{ ts: string; cmd: string; ok: boolean }[]>([])
  const [actioningId, setActioningId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [posRes, sigRes, tradeRes, pmRes, btRes] = await Promise.all([
        lifeos.from('geoff_positions').select('*').order('created_at', { ascending: false }),
        lifeos.from('xena_alpha_signals').select('*').order('score', { ascending: false }).limit(100),
        lifeos.from('trades').select('*').order('created_at', { ascending: false }).limit(200),
        lifeos.from('geoff_pm_trades').select('*').order('created_at', { ascending: false }).limit(200),
        lifeos.from('geoff_backtest_results').select('*').order('win_rate', { ascending: false }).limit(20),
      ])
      setPositions(posRes.data || [])
      setSignals(sigRes.data || [])
      setTrades(tradeRes.data || [])
      setPmTrades(pmRes.data || [])
      setBacktest(btRes.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function approveSignal(sig: XenaAlphaSignal, action: 'APPROVED' | 'REJECTED' | 'WATCHING') {
    setActioningId(sig.id)
    const { error } = await lifeos
      .from('xena_alpha_signals')
      .update({ geoff_action: action, geoff_reviewed: true })
      .eq('id', sig.id)
    if (!error) {
      setSignals(prev => prev.map(s => s.id === sig.id ? { ...s, geoff_action: action, geoff_reviewed: true } : s))
      if (action === 'APPROVED') {
        // Also create a harness task for GEOFF to act on
        await lifeos.from('harness_tasks').insert({
          task_id: `GEOFF-TRADE-${Date.now()}`,
          title: `Trade signal: ${sig.token_symbol} (${sig.signal_strength})`,
          description: `Signal approved. Token: ${sig.token_symbol} | Mint: ${sig.token_mint} | Score: ${sig.score} | Source: ${sig.source_account}`,
          owner_agent: 'geoff',
          routed_to: 'geoff',
          status: 'pending',
          priority: sig.signal_strength === 'STRONG' ? 'high' : 'normal',
        })
      }
    }
    setActioningId(null)
  }

  async function sendCommand() {
    if (!command.trim()) return
    setCmdSending(true)
    const cmd = command.trim()
    const { error } = await lifeos.from('harness_tasks').insert({
      task_id: `GEOFF-CMD-${Date.now()}`,
      title: cmd,
      description: `Manual command from Mission Control dashboard`,
      owner_agent: 'geoff',
      routed_to: 'geoff',
      status: 'pending',
      priority: 'high',
      source: 'mission_control',
    })
    setCmdLog(prev => [{ ts: new Date().toLocaleTimeString(), cmd, ok: !error }, ...prev.slice(0, 9)])
    if (!error) setCommand('')
    setCmdSending(false)
  }

  const totalPnl = [...trades, ...pmTrades].reduce((s, t) => s + (t.pnl || 0), 0)
  const wins = [...trades, ...pmTrades].filter(t => (t.pnl || 0) > 0).length
  const total = trades.length + pmTrades.length
  const winRate = total > 0 ? (wins / total * 100).toFixed(0) : '—'
  const strongSignals = signals.filter(s => s.signal_strength?.toUpperCase() === 'STRONG').length
  const pendingSignals = signals.filter(s => !s.geoff_reviewed).length

  // Build PnL chart data from trades
  const pnlData = [...trades].reverse().reduce((acc: { date: string; cumPnl: number }[], t) => {
    const prev = acc[acc.length - 1]?.cumPnl || 0
    acc.push({
      date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cumPnl: prev + (t.pnl || 0),
    })
    return acc
  }, [])

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'chart', label: '📈 Chart' },
    { key: 'overview', label: 'Overview' },
    { key: 'strategies', label: '🎯 Strategies' },
    { key: 'positions', label: 'Positions', badge: positions.length },
    { key: 'signals', label: 'Signals', badge: pendingSignals || undefined },
    { key: 'history', label: 'History', badge: undefined },
    { key: 'control', label: 'Control' },
  ]

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
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-xl">📈</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">GEOFF Trading</h2>
            <p className="text-gray-500 text-sm">Finance & Prediction Markets Control Center</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Open Positions" value={positions.length} icon={<Activity className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Total PnL" value={`$${totalPnl.toFixed(2)}`} icon={<DollarSign className="w-5 h-5" />} color={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={<Target className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Pending Signals" value={pendingSignals} icon={<Zap className="w-5 h-5" />} color="text-yellow-400" />
        <StatCard label="Strong Signals" value={strongSignals} icon={<TrendingUp className="w-5 h-5" />} color="text-pink-400" />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="bg-yellow-500 text-black text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CHART TAB */}
      {tab === 'chart' && (
        <div className="-mx-6 -mt-5">
          <GeoffChart />
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* PnL Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Cumulative PnL</h3>
              <span className={`text-lg font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${totalPnl.toFixed(2)}
              </span>
            </div>
            {pnlData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={pnlData}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={totalPnl >= 0 ? '#10B981' : '#EF4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={totalPnl >= 0 ? '#10B981' : '#EF4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cumulative PnL']}
                  />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="cumPnl" stroke={totalPnl >= 0 ? '#10B981' : '#EF4444'} fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart2 className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No trade history yet</p>
                  <p className="text-gray-600 text-xs">Chart will populate as GEOFF trades</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Signals */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Recent Alpha Signals</h3>
              <button onClick={() => setTab('signals')} className="text-xs text-emerald-400 hover:underline">
                View all →
              </button>
            </div>
            {signals.slice(0, 5).map(sig => (
              <SignalRow key={sig.id} sig={sig} onAction={approveSignal} actioning={actioningId === sig.id} compact />
            ))}
            {signals.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">No signals yet</div>
            )}
          </div>
        </div>
      )}

      {/* POSITIONS TAB */}
      {tab === 'positions' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Open Positions</h3>
            <p className="text-gray-500 text-xs mt-0.5">Live positions tracked by GEOFF</p>
          </div>
          {positions.length === 0 ? (
            <div className="p-16 text-center">
              <Activity className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No open positions</p>
              <p className="text-gray-600 text-xs mt-1">GEOFF's active trades will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Symbol', 'Side', 'Size', 'Entry', 'Current', 'PnL', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {positions.map(pos => (
                    <tr key={pos.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4 text-white font-bold text-sm">{pos.symbol || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          pos.side?.toLowerCase() === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{pos.side || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-300 text-sm">{pos.size ?? '—'}</td>
                      <td className="px-5 py-4 text-gray-300 text-sm">
                        {pos.entry_price != null ? `$${pos.entry_price.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-gray-300 text-sm">
                        {pos.current_price != null ? `$${pos.current_price.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`font-bold text-sm ${(pos.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
      )}

      {/* SIGNALS TAB */}
      {tab === 'signals' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">{pendingSignals} signals awaiting review</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400">{signals.filter(s => s.geoff_action === 'APPROVED').length} approved</span>
          </div>
          {signals.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <Zap className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No signals yet</p>
            </div>
          ) : signals.map(sig => (
            <SignalRow key={sig.id} sig={sig} onAction={approveSignal} actioning={actioningId === sig.id} />
          ))}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Trade History Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Trade History</h3>
                <p className="text-gray-500 text-xs mt-0.5">{trades.length + pmTrades.length} total trades</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} total
                </span>
              </div>
            </div>
            {trades.length === 0 && pmTrades.length === 0 ? (
              <div className="p-16 text-center">
                <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No trade history</p>
                <p className="text-gray-600 text-xs mt-1">Completed trades will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Symbol / Market', 'Side', 'Size', 'Price', 'PnL', 'Date'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {[...trades.map(t => ({ ...t, _type: 'trade' })), ...pmTrades.map(t => ({ ...t, _type: 'pm', symbol: t.market_title }))].map(t => (
                      <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-white font-semibold text-sm truncate max-w-[200px]">{t.symbol || '—'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            t.side?.toLowerCase() === 'yes' || t.side?.toLowerCase() === 'long'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}>{t.side || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-300 text-sm">{'size' in t ? t.size ?? '—' : 'contracts' in t ? (t as GeoffPMTrade).contracts ?? '—' : '—'}</td>
                        <td className="px-5 py-4 text-gray-300 text-sm">
                          {'price' in t && t.price != null ? `$${Number(t.price).toLocaleString()}` : 'avg_price' in t && (t as GeoffPMTrade).avg_price != null ? `${(t as GeoffPMTrade).avg_price}¢` : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`font-bold text-sm ${(t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 text-xs">{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STRATEGIES TAB */}
      {tab === 'strategies' && (
        <div className="space-y-6">
          {/* Backtest Win Rate Chart */}
          {backtest.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-white font-semibold">Strategy Win Rates (Backtested)</h3>
                <span className="text-gray-500 text-xs ml-auto">1m candles · 12.5× leverage</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={backtest.map(b => ({
                    name: b.strategy_name.replace(/_/g, ' ').replace('bull flag', '🚩').replace('first green', '🟢').slice(0, 20),
                    winRate: parseFloat((b.win_rate || 0).toFixed(1)),
                    trades: b.total_trades,
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }}
                    width={140} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(v: number, name) => [name === 'winRate' ? `${v}%` : v, name === 'winRate' ? 'Win Rate' : 'Trades']}
                  />
                  <ReferenceLine x={50} stroke="#374151" strokeDasharray="4 4" />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fill: '#9ca3af', fontSize: 10, formatter: (v: number) => `${v}%` }}>
                    {backtest.map((b, i) => (
                      <Cell key={i} fill={b.win_rate >= 60 ? '#10b981' : b.win_rate >= 50 ? '#3b82f6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {/* Trade Count + PnL chart */}
          {backtest.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4 text-sm">Trades Tested per Strategy</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={backtest.map(b => ({ name: b.strategy_name.replace(/_/g, ' ').slice(0, 18), trades: b.total_trades, wins: b.winning_trades }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="trades" name="Total" fill="#374151" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="wins" name="Wins" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Win / Loss pie for top strategy */}
              {backtest[0] && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
                  <h3 className="text-white font-semibold mb-1 text-sm">Top Strategy: {backtest[0].strategy_name.replace(/_/g, ' ')}</h3>
                  <p className="text-gray-500 text-xs mb-4">{backtest[0].verdict || 'Backtested on historical signals'}</p>
                  <div className="flex items-center justify-center flex-1">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Wins', value: backtest[0].winning_trades },
                            { name: 'Losses', value: backtest[0].total_trades - backtest[0].winning_trades },
                          ]}
                          cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                          paddingAngle={3} dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 text-xs">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-400">{(backtest[0].win_rate || 0).toFixed(0)}%</p>
                      <p className="text-gray-500">Win Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-400">{backtest[0].total_trades}</p>
                      <p className="text-gray-500">Trades</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Strategy Guide Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[
              {
                icon: '🚩', name: 'Bull Flag', color: 'border-blue-500/30 bg-blue-500/5',
                tagline: 'Momentum consolidation breakout',
                explain: 'Token pumps hard (flagpole), consolidates sideways ≤1% for 3 candles (the flag), then breaks up again. We buy at the breakout.',
                params: 'Range ≤ 1.0% · TP = 2× range · SL = consolidation low',
                result: '72.7% WR · +9.79% avg leveraged PnL · 22 trades',
              },
              {
                icon: '🟢', name: 'First Green After 3 Reds', color: 'border-emerald-500/30 bg-emerald-500/5',
                tagline: 'Mean-reversion bounce',
                explain: 'After 3 consecutive red candles (panic selling overshoots), the first green candle signals smart money stepping in.',
                params: '3 reds → buy first green · TP +3% · SL -1.5%',
                result: '57.1% WR · +10.83% avg leveraged PnL · 70 trades',
              },
              {
                icon: '📉', name: 'Short Post-Pump', color: 'border-red-500/30 bg-red-500/5',
                tagline: 'Hype-fade reversal short',
                explain: 'After a token pumps >15% in 5 min, the hype dies and early buyers sell. We short the fade. High risk, best in bear markets.',
                params: 'Pump >15% → short · TP = 50% of pump · SL = new high',
                result: 'Best in bearish conditions',
              },
              {
                icon: '⚡', name: 'Drift Scalper (SOL-PERP)', color: 'border-purple-500/30 bg-purple-500/5',
                tagline: 'Leverage momentum — Drift Protocol',
                explain: 'Reads SOL perpetual funding rate + price momentum. Enters 10× leveraged longs/shorts when both signals align. Now LIVE.',
                params: '$2 collateral × 10x · TP +2% · SL -1% · Max 5min hold',
                result: '🔴 LIVE — $25 USDC allocated on Drift',
              },
            ].map(({ icon, name, color, tagline, explain, params, result }) => (
              <div key={name} className={`rounded-xl border p-5 ${color}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{name}</h3>
                    <p className="text-gray-400 text-xs italic mb-2">{tagline}</p>
                    <p className="text-gray-300 text-xs leading-relaxed mb-2">{explain}</p>
                    <p className="font-mono text-gray-500 text-[11px] mb-1">{params}</p>
                    <p className="text-emerald-400 text-[11px]">{result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Score tiers */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-yellow-400" />
              <h3 className="text-white font-semibold text-sm">Signal Score Tiers</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { range: '55–64', label: 'Watch', desc: 'Paper only', color: 'border-gray-700 text-gray-400' },
                { range: '65–74', label: 'Moderate', desc: 'Small paper trade', color: 'border-blue-700/50 text-blue-400' },
                { range: '75–84', label: 'High', desc: 'Active paper', color: 'border-yellow-700/50 text-yellow-400' },
                { range: '85+',   label: 'Max', desc: 'Live candidate', color: 'border-emerald-700/50 text-emerald-400' },
              ].map(({ range, label, desc, color }) => (
                <div key={range} className={`rounded-lg border p-3 bg-gray-800/40 ${color}`}>
                  <p className="font-mono text-lg font-bold">{range}</p>
                  <p className="font-semibold text-xs mt-0.5">{label}</p>
                  <p className="text-gray-600 text-xs">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTROL TAB */}
      {tab === 'control' && (
        <div className="space-y-5">
          {/* Quick Commands */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">Quick Commands</h3>
            <p className="text-gray-500 text-xs mb-4">One-click — instantly queued to GEOFF via harness</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_COMMANDS.map(qc => (
                <button
                  key={qc.label}
                  onClick={async () => {
                    const { error } = await lifeos.from('harness_tasks').insert({
                      task_id: `GEOFF-CMD-${Date.now()}`,
                      title: qc.cmd,
                      description: `Quick command from Mission Control`,
                      owner_agent: 'geoff',
                      routed_to: 'geoff',
                      status: 'pending',
                      priority: 'high',
                      source: 'mission_control',
                    })
                    setCmdLog(prev => [{ ts: new Date().toLocaleTimeString(), cmd: qc.cmd, ok: !error }, ...prev.slice(0, 9)])
                  }}
                  className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500/40 rounded-xl text-left transition-all group"
                >
                  <div className="text-white text-xs font-medium group-hover:text-emerald-400 transition-colors">{qc.label}</div>
                  <div className="text-gray-600 text-xs mt-1 truncate">{qc.cmd.replace('GEOFF: ', '')}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Command Input */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-semibold">Command GEOFF</h3>
            </div>
            <p className="text-gray-500 text-xs mb-4">
              Commands are written to harness_tasks and picked up by GEOFF on his next cycle.
            </p>
            <div className="flex gap-2">
              <textarea
                id="geoff-command-input"
                name="geoff-command"
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder="e.g. GEOFF: analyze SOL/USD technical setup and give entry recommendation"
                rows={3}
                autoComplete="off"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendCommand() }}
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-gray-600 text-xs">Cmd+Enter to send · Commands routed to geoff agent</span>
              <button
                onClick={sendCommand}
                disabled={!command.trim() || cmdSending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {cmdSending ? 'Sending...' : 'Send Command'}
              </button>
            </div>
          </div>

          {/* Command Log */}
          {cmdLog.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">Command Log</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {cmdLog.map((entry, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    {entry.ok
                      ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-300 text-xs">{entry.cmd}</div>
                      <div className="text-gray-600 text-xs mt-0.5">{entry.ts}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${entry.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {entry.ok ? 'queued' : 'failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-400/80 text-xs">
              Commands are queued in harness_tasks with owner_agent=geoff. GEOFF will process them on his next active cycle. High priority commands are processed first.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SignalRow({
  sig, onAction, actioning, compact = false
}: {
  sig: XenaAlphaSignal
  onAction: (sig: XenaAlphaSignal, action: 'APPROVED' | 'REJECTED' | 'WATCHING') => void
  actioning: boolean
  compact?: boolean
}) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors ${compact ? 'border-0 rounded-none border-b' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm">{sig.token_symbol}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${signalBadge(sig.signal_strength)}`}>
              {sig.signal_strength}
            </span>
            {sig.geoff_action && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${actionBadge(sig.geoff_action)}`}>
                {sig.geoff_action}
              </span>
            )}
            {sig.score != null && (
              <span className="text-yellow-400 text-xs font-medium">Score: {sig.score.toFixed(1)}</span>
            )}
            <span className="text-gray-600 text-xs ml-auto">{fmtDate(sig.created_at)}</span>
          </div>
          {!compact && sig.post_content && (
            <p className="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{sig.post_content}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {sig.source_account && <span className="text-gray-600 text-xs">{sig.source_account}</span>}
            {sig.caller_win_rate != null && (
              <span className="text-gray-500 text-xs">WR: {(sig.caller_win_rate * 100).toFixed(0)}%</span>
            )}
            {sig.on_chain_confirmed && (
              <span className="text-emerald-500 text-xs">On-chain ✓</span>
            )}
            {sig.token_mint && (
              <a
                href={`https://birdeye.so/token/${sig.token_mint}?chain=solana`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                onClick={e => e.stopPropagation()}
              >
                Chart <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!sig.geoff_reviewed && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onAction(sig, 'APPROVED')}
              disabled={actioning}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => onAction(sig, 'WATCHING')}
              disabled={actioning}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-40"
            >
              Watch
            </button>
            <button
              onClick={() => onAction(sig, 'REJECTED')}
              disabled={actioning}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              <XCircle className="w-3.5 h-3.5" /> Pass
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
