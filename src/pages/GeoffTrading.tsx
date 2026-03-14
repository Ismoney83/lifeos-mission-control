import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import type { GeoffPosition, XenaAlphaSignal, Trade, GeoffPMTrade } from '../types'
import { GeoffChart } from '../components/GeoffChart'
import {
  Activity, BarChart2, Zap, CheckCircle, XCircle,
  Terminal, Send, ExternalLink, RefreshCw, AlertTriangle,
  Target, BookOpen
} from 'lucide-react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Cell, PieChart, Pie, CartesianGrid
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

function scoreColor(score: number | null) {
  if (score == null) return 'text-gray-500 bg-gray-800 border-gray-700'
  if (score >= 75) return 'text-[#22ff88] bg-[#22ff88]/10 border-[#22ff88]/30'
  if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  return 'text-red-400 bg-red-500/10 border-red-500/30'
}

function strengthColor(strength: string) {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'text-[#22ff88] bg-[#22ff88]/10 border-[#22ff88]/30'
    case 'MEDIUM': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    case 'WEAK': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-500 bg-gray-800 border-gray-700'
  }
}

function actionColor(action: string | null) {
  switch (action?.toUpperCase()) {
    case 'APPROVED': return 'text-[#22ff88] bg-[#22ff88]/10 border-[#22ff88]/30'
    case 'REJECTED': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'WATCHING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    default: return 'text-gray-600 bg-gray-800/50 border-gray-700/50'
  }
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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
    const { error: updateErr } = await lifeos
      .from('xena_alpha_signals')
      .update({ geoff_action: action, geoff_reviewed: true })
      .eq('id', sig.id)
    if (!updateErr) {
      setSignals(prev => prev.map(s => s.id === sig.id ? { ...s, geoff_action: action, geoff_reviewed: true } : s))
      if (action === 'APPROVED') {
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
    const { error: cmdErr } = await lifeos.from('harness_tasks').insert({
      task_id: `GEOFF-CMD-${Date.now()}`,
      title: cmd,
      description: `Manual command from Mission Control dashboard`,
      owner_agent: 'geoff',
      routed_to: 'geoff',
      status: 'pending',
      priority: 'high',
      source: 'mission_control',
    })
    setCmdLog(prev => [{ ts: new Date().toLocaleTimeString(), cmd, ok: !cmdErr }, ...prev.slice(0, 9)])
    if (!cmdErr) setCommand('')
    setCmdSending(false)
  }

  const totalPnl = [...trades, ...pmTrades].reduce((s, t) => s + (t.pnl || 0), 0)
  const wins = [...trades, ...pmTrades].filter(t => (t.pnl || 0) > 0).length
  const total = trades.length + pmTrades.length
  const winRate = total > 0 ? Math.round(wins / total * 100) : null
  const strongSignals = signals.filter(s => s.signal_strength?.toUpperCase() === 'STRONG').length
  const pendingSignals = signals.filter(s => !s.geoff_reviewed).length

  const pnlData = [...trades].reverse().reduce((acc: { date: string; cumPnl: number }[], t) => {
    const prev = acc[acc.length - 1]?.cumPnl || 0
    acc.push({
      date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cumPnl: prev + (t.pnl || 0),
    })
    return acc
  }, [])

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'chart', label: 'CHART' },
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'strategies', label: 'STRATEGIES' },
    { key: 'positions', label: 'POSITIONS', badge: positions.length },
    { key: 'signals', label: 'SIGNALS', badge: pendingSignals || undefined },
    { key: 'history', label: 'HISTORY' },
    { key: 'control', label: 'CONTROL' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: '#0a0b0d' }}>
        <div className="flex items-center gap-3" style={{ color: '#64748b' }}>
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#22ff88', borderTopColor: 'transparent' }} />
          <span className="font-mono text-sm">Loading GEOFF data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ background: '#0a0b0d', minHeight: '100%' }}>

      {/* ── Axiom-style Header Bar ── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: '#111318', borderColor: '#2a2d35' }}
      >
        {/* Left: Logo + name */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg font-mono font-bold text-sm"
            style={{ background: 'rgba(34,255,136,0.1)', border: '1px solid rgba(34,255,136,0.25)', color: '#22ff88' }}
          >
            G
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm tracking-wide">GEOFF</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Trading Terminal</span>
              {/* Live badge */}
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{ background: 'rgba(34,255,136,0.08)', border: '1px solid rgba(34,255,136,0.2)', color: '#22ff88' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22ff88' }} />
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live stat chips */}
        <div className="flex items-center gap-2">
          {/* Total PnL chip */}
          <div
            className="px-3 py-1 rounded font-mono text-xs font-bold"
            style={{
              background: totalPnl >= 0 ? 'rgba(34,255,136,0.08)' : 'rgba(255,51,102,0.08)',
              border: `1px solid ${totalPnl >= 0 ? 'rgba(34,255,136,0.2)' : 'rgba(255,51,102,0.2)'}`,
              color: totalPnl >= 0 ? '#22ff88' : '#ff3366',
              boxShadow: totalPnl >= 0 ? '0 0 12px rgba(34,255,136,0.1)' : '0 0 12px rgba(255,51,102,0.1)',
            }}
          >
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
          {/* Positions chip */}
          <div
            className="px-2.5 py-1 rounded font-mono text-xs"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}
          >
            {positions.length} pos
          </div>
          {/* Win rate chip */}
          {winRate !== null && (
            <div
              className="px-2.5 py-1 rounded font-mono text-xs font-bold"
              style={{
                background: winRate >= 60 ? 'rgba(34,255,136,0.08)' : winRate >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(255,51,102,0.08)',
                border: `1px solid ${winRate >= 60 ? 'rgba(34,255,136,0.2)' : winRate >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(255,51,102,0.2)'}`,
                color: winRate >= 60 ? '#22ff88' : winRate >= 40 ? '#f59e0b' : '#ff3366',
              }}
            >
              {winRate}% WR
            </div>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
            style={{ background: '#1a1d24', border: '1px solid #2a2d35', color: '#64748b' }}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-4 py-2.5 rounded text-xs font-mono" style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.25)', color: '#ff3366' }}>
          {error}
        </div>
      )}

      {/* ── Axiom Stats Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 px-5 pt-4 pb-1">
        {[
          {
            label: 'Open Positions',
            value: positions.length,
            mono: true,
            accent: '#60a5fa',
            icon: <Activity className="w-3.5 h-3.5" />,
          },
          {
            label: 'Total PnL',
            value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
            mono: true,
            accent: totalPnl >= 0 ? '#22ff88' : '#ff3366',
            glow: totalPnl >= 0 ? '0 0 12px rgba(34,255,136,0.15)' : '0 0 12px rgba(255,51,102,0.15)',
            icon: null,
          },
          {
            label: 'Win Rate',
            value: winRate !== null ? `${winRate}%` : '—',
            mono: true,
            accent: winRate === null ? '#64748b' : winRate >= 60 ? '#22ff88' : winRate >= 40 ? '#f59e0b' : '#ff3366',
            icon: <Target className="w-3.5 h-3.5" />,
          },
          {
            label: 'Pending Signals',
            value: pendingSignals,
            mono: true,
            accent: '#f59e0b',
            icon: <Zap className="w-3.5 h-3.5" />,
          },
          {
            label: 'Strong Signals',
            value: strongSignals,
            mono: true,
            accent: '#22ff88',
            glow: '0 0 12px rgba(34,255,136,0.1)',
            icon: null,
          },
        ].map(({ label, value, mono, accent, glow, icon }) => (
          <div
            key={label}
            className="rounded-lg p-3"
            style={{
              background: '#111318',
              borderTop: `2px solid ${accent}`,
              border: `1px solid #2a2d35`,
              borderTopColor: accent,
              boxShadow: glow,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</span>
              {icon && <span style={{ color: accent }}>{icon}</span>}
            </div>
            <div
              className={`text-xl font-bold ${mono ? 'font-mono' : ''}`}
              style={{ color: accent }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Axiom Tab Bar ── */}
      <div
        className="flex items-center gap-0 px-5 pt-4 border-b"
        style={{ borderColor: '#2a2d35' }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono font-medium tracking-wider transition-colors"
            style={{
              color: tab === t.key ? '#e2e8f0' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #22ff88' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className="flex items-center justify-center text-[9px] font-bold rounded-full w-4 h-4"
                style={{ background: '#22ff88', color: '#0a0b0d' }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 p-5">

        {/* CHART TAB */}
        {tab === 'chart' && (
          <div className="-mx-5 -mt-5">
            <GeoffChart />
          </div>
        )}

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* PnL Area Chart */}
            <div
              className="rounded-lg p-4"
              style={{ background: '#111318', border: '1px solid #2a2d35' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-mono mb-1" style={{ color: '#64748b' }}>Cumulative PnL</div>
                  <div
                    className="text-2xl font-bold font-mono"
                    style={{ color: totalPnl >= 0 ? '#22ff88' : '#ff3366', textShadow: totalPnl >= 0 ? '0 0 16px rgba(34,255,136,0.4)' : '0 0 16px rgba(255,51,102,0.4)' }}
                  >
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: '#64748b' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22ff88' }} />
                  LIVE
                </div>
              </div>
              {pnlData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={pnlData}>
                    <defs>
                      <linearGradient id="pnlGradAxiom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={totalPnl >= 0 ? '#22ff88' : '#ff3366'} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={totalPnl >= 0 ? '#22ff88' : '#ff3366'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#111318', border: '1px solid #2a2d35', borderRadius: '6px', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontFamily: 'monospace' }}
                      itemStyle={{ fontFamily: 'monospace' }}
                      formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Cumulative PnL']}
                    />
                    <ReferenceLine y={0} stroke="#2a2d35" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="cumPnl"
                      stroke={totalPnl >= 0 ? '#22ff88' : '#ff3366'}
                      fill="url(#pnlGradAxiom)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[160px] flex items-center justify-center">
                  <div className="text-center">
                    <BarChart2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#2a2d35' }} />
                    <p className="text-xs font-mono" style={{ color: '#64748b' }}>No trade history yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Signals — Axiom dense rows */}
            <div className="rounded-lg overflow-hidden" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2d35' }}>
                <span className="text-xs font-mono font-semibold" style={{ color: '#e2e8f0' }}>Recent Alpha Signals</span>
                <button
                  onClick={() => setTab('signals')}
                  className="text-[10px] font-mono transition-colors hover:underline"
                  style={{ color: '#22ff88' }}
                >
                  View all →
                </button>
              </div>
              {signals.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono" style={{ color: '#64748b' }}>No signals yet</div>
              ) : signals.slice(0, 5).map((sig, idx) => (
                <AxiomSignalRow key={sig.id} sig={sig} rank={idx + 1} onAction={approveSignal} actioning={actioningId === sig.id} compact />
              ))}
            </div>
          </div>
        )}

        {/* POSITIONS TAB */}
        {tab === 'positions' && (
          <div className="rounded-lg overflow-hidden" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#2a2d35' }}>
              <span className="text-xs font-mono font-semibold" style={{ color: '#e2e8f0' }}>Open Positions</span>
              <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>Live positions tracked by GEOFF</span>
            </div>
            {positions.length === 0 ? (
              <div className="p-16 text-center">
                <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: '#2a2d35' }} />
                <p className="text-xs font-mono" style={{ color: '#64748b' }}>No open positions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a2d35' }}>
                      {['Symbol', 'Side', 'Size', 'Entry', 'Current', 'PnL', 'Status'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: '#64748b' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => (
                      <tr
                        key={pos.id}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid rgba(42,45,53,0.5)', height: '40px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1a1d24')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="px-4 py-0 font-mono font-bold text-xs" style={{ color: '#e2e8f0' }}>{pos.symbol || '—'}</td>
                        <td className="px-4 py-0">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase"
                            style={{
                              background: pos.side?.toLowerCase() === 'long' ? 'rgba(34,255,136,0.1)' : 'rgba(255,51,102,0.1)',
                              color: pos.side?.toLowerCase() === 'long' ? '#22ff88' : '#ff3366',
                              border: `1px solid ${pos.side?.toLowerCase() === 'long' ? 'rgba(34,255,136,0.25)' : 'rgba(255,51,102,0.25)'}`,
                            }}
                          >
                            {pos.side || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-0 font-mono text-xs" style={{ color: '#94a3b8' }}>{pos.size ?? '—'}</td>
                        <td className="px-4 py-0 font-mono text-xs text-right" style={{ color: '#94a3b8' }}>
                          {pos.entry_price != null ? `$${pos.entry_price.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-0 font-mono text-xs text-right" style={{ color: '#94a3b8' }}>
                          {pos.current_price != null ? `$${pos.current_price.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-0">
                          <span
                            className="font-mono font-bold text-xs"
                            style={{ color: (pos.pnl || 0) >= 0 ? '#22ff88' : '#ff3366' }}
                          >
                            {pos.pnl != null ? `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-0 font-mono text-[10px]" style={{ color: '#64748b' }}>{pos.status || '—'}</td>
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
            {/* Stats strip */}
            <div className="flex items-center gap-4 text-[11px] font-mono" style={{ color: '#64748b' }}>
              <span><span className="font-bold" style={{ color: '#f59e0b' }}>{pendingSignals}</span> awaiting review</span>
              <span style={{ color: '#2a2d35' }}>·</span>
              <span><span className="font-bold" style={{ color: '#22ff88' }}>{signals.filter(s => s.geoff_action === 'APPROVED').length}</span> approved</span>
              <span style={{ color: '#2a2d35' }}>·</span>
              <span><span className="font-bold" style={{ color: '#94a3b8' }}>{signals.length}</span> total</span>
            </div>

            {signals.length === 0 ? (
              <div className="rounded-lg p-16 text-center" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: '#2a2d35' }} />
                <p className="text-xs font-mono" style={{ color: '#64748b' }}>No signals yet</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                {/* Header row */}
                <div
                  className="grid gap-0 px-3 py-2 border-b text-[10px] font-mono uppercase tracking-wider"
                  style={{ borderColor: '#2a2d35', color: '#64748b', gridTemplateColumns: '28px 80px 52px 90px 70px 60px 1fr 160px' }}
                >
                  <span>#</span>
                  <span>Token</span>
                  <span>Score</span>
                  <span>Type</span>
                  <span>Strength</span>
                  <span>Chain</span>
                  <span>Time</span>
                  <span className="text-right">Actions</span>
                </div>
                {signals.map((sig, idx) => (
                  <AxiomSignalRow key={sig.id} sig={sig} rank={idx + 1} onAction={approveSignal} actioning={actioningId === sig.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="rounded-lg overflow-hidden" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#2a2d35' }}>
              <div>
                <span className="text-xs font-mono font-semibold" style={{ color: '#e2e8f0' }}>Trade History</span>
                <span className="ml-3 text-[10px] font-mono" style={{ color: '#64748b' }}>{trades.length + pmTrades.length} trades</span>
              </div>
              <span
                className="text-sm font-bold font-mono"
                style={{ color: totalPnl >= 0 ? '#22ff88' : '#ff3366' }}
              >
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} total
              </span>
            </div>
            {trades.length === 0 && pmTrades.length === 0 ? (
              <div className="p-16 text-center">
                <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#2a2d35' }} />
                <p className="text-xs font-mono" style={{ color: '#64748b' }}>No trade history</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a2d35' }}>
                      {['Symbol / Market', 'Side', 'Size', 'Price', 'PnL', 'Date'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...trades.map(t => ({ ...t, _type: 'trade' })), ...pmTrades.map(t => ({ ...t, _type: 'pm', symbol: t.market_title }))].map(t => {
                      const isWin = (t.pnl || 0) > 0
                      return (
                        <tr
                          key={t.id}
                          className="transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(42,45,53,0.5)',
                            height: '40px',
                            borderLeft: `2px solid ${isWin ? 'rgba(34,255,136,0.4)' : t.pnl != null ? 'rgba(255,51,102,0.4)' : 'transparent'}`,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1a1d24')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-4 py-0">
                            <div className="font-mono font-semibold text-xs truncate max-w-[180px]" style={{ color: '#e2e8f0' }}>{t.symbol || '—'}</div>
                          </td>
                          <td className="px-4 py-0">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase"
                              style={{
                                background: (t.side?.toLowerCase() === 'yes' || t.side?.toLowerCase() === 'long') ? 'rgba(34,255,136,0.08)' : 'rgba(255,51,102,0.08)',
                                color: (t.side?.toLowerCase() === 'yes' || t.side?.toLowerCase() === 'long') ? '#22ff88' : '#ff3366',
                              }}
                            >
                              {t.side || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-0 font-mono text-xs" style={{ color: '#94a3b8' }}>
                            {'size' in t ? t.size ?? '—' : 'contracts' in t ? (t as GeoffPMTrade).contracts ?? '—' : '—'}
                          </td>
                          <td className="px-4 py-0 font-mono text-xs text-right" style={{ color: '#94a3b8' }}>
                            {'price' in t && t.price != null
                              ? `$${Number(t.price).toLocaleString()}`
                              : 'avg_price' in t && (t as GeoffPMTrade).avg_price != null
                              ? `${(t as GeoffPMTrade).avg_price}¢`
                              : '—'}
                          </td>
                          <td className="px-4 py-0">
                            <span
                              className="font-mono font-bold text-xs"
                              style={{ color: (t.pnl || 0) >= 0 ? '#22ff88' : '#ff3366' }}
                            >
                              {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-0 font-mono text-[10px]" style={{ color: '#64748b' }}>{fmtTime(t.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STRATEGIES TAB */}
        {tab === 'strategies' && (
          <div className="space-y-5">
            {/* Win Rate Chart */}
            {backtest.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4" style={{ color: '#22ff88' }} />
                  <span className="text-xs font-mono font-semibold" style={{ color: '#e2e8f0' }}>Strategy Win Rates (Backtested)</span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: '#64748b' }}>1m candles · 12.5× leverage</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={backtest.map(b => ({
                      name: b.strategy_name.replace(/_/g, ' ').slice(0, 22),
                      winRate: parseFloat((b.win_rate || 0).toFixed(1)),
                      trades: b.total_trades,
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      width={145} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#111318', border: '1px solid #2a2d35', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                      formatter={(v: unknown) => [`${v}%`, 'Win Rate']}
                    />
                    <ReferenceLine x={50} stroke="#2a2d35" strokeDasharray="4 4" />
                    <Bar dataKey="winRate" radius={[0, 3, 3, 0]}
                      label={{ position: 'right', fill: '#64748b', fontSize: 10, fontFamily: 'monospace', formatter: (v: unknown) => `${v}%` }}>
                      {backtest.map((b, i) => (
                        <Cell
                          key={i}
                          fill={b.win_rate >= 60 ? '#22ff88' : b.win_rate >= 50 ? '#60a5fa' : '#ff3366'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trade count + top strategy pie */}
            {backtest.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-lg p-4" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                  <div className="text-xs font-mono font-semibold mb-4" style={{ color: '#e2e8f0' }}>Trades Tested per Strategy</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={backtest.map(b => ({
                      name: b.strategy_name.replace(/_/g, ' ').slice(0, 18),
                      trades: b.total_trades,
                      wins: b.winning_trades,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#111318', border: '1px solid #2a2d35', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }} />
                      <Bar dataKey="trades" name="Total" fill="#2a2d35" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="wins" name="Wins" fill="#22ff88" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {backtest[0] && (
                  <div className="rounded-lg p-4 flex flex-col" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                    <div className="text-xs font-mono font-semibold mb-0.5" style={{ color: '#e2e8f0' }}>
                      Top: {backtest[0].strategy_name.replace(/_/g, ' ')}
                    </div>
                    <p className="text-[10px] font-mono mb-3" style={{ color: '#64748b' }}>{backtest[0].verdict || 'Backtested on historical signals'}</p>
                    <div className="flex items-center justify-center flex-1">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Wins', value: backtest[0].winning_trades },
                              { name: 'Losses', value: backtest[0].total_trades - backtest[0].winning_trades },
                            ]}
                            cx="50%" cy="50%" innerRadius={40} outerRadius={58}
                            paddingAngle={3} dataKey="value"
                          >
                            <Cell fill="#22ff88" />
                            <Cell fill="#ff3366" />
                          </Pie>
                          <Tooltip contentStyle={{ background: '#111318', border: '1px solid #2a2d35', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 text-xs">
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: backtest[0].win_rate >= 60 ? '#22ff88' : '#f59e0b' }}>
                          {(backtest[0].win_rate || 0).toFixed(0)}%
                        </p>
                        <p className="font-mono" style={{ color: '#64748b' }}>Win Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: '#60a5fa' }}>{backtest[0].total_trades}</p>
                        <p className="font-mono" style={{ color: '#64748b' }}>Trades</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Strategy guide cards — Axiom dark */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {[
                {
                  icon: '🚩', name: 'Bull Flag',
                  accentColor: '#60a5fa',
                  tagline: 'Momentum consolidation breakout',
                  explain: 'Token pumps hard (flagpole), consolidates sideways ≤1% for 3 candles (the flag), then breaks up again. We buy at the breakout.',
                  params: 'Range ≤ 1.0% · TP = 2× range · SL = consolidation low',
                  result: '72.7% WR · +9.79% avg leveraged PnL · 22 trades',
                  isHigh: true,
                },
                {
                  icon: '🟢', name: 'First Green After 3 Reds',
                  accentColor: '#22ff88',
                  tagline: 'Mean-reversion bounce',
                  explain: 'After 3 consecutive red candles (panic selling overshoots), the first green candle signals smart money stepping in.',
                  params: '3 reds → buy first green · TP +3% · SL -1.5%',
                  result: '57.1% WR · +10.83% avg leveraged PnL · 70 trades',
                  isHigh: false,
                },
                {
                  icon: '📉', name: 'Short Post-Pump',
                  accentColor: '#ff3366',
                  tagline: 'Hype-fade reversal short',
                  explain: 'After a token pumps >15% in 5 min, the hype dies and early buyers sell. We short the fade. High risk, best in bear markets.',
                  params: 'Pump >15% → short · TP = 50% of pump · SL = new high',
                  result: 'Best in bearish conditions',
                  isHigh: false,
                },
                {
                  icon: '⚡', name: 'Drift Scalper (SOL-PERP)',
                  accentColor: '#a855f7',
                  tagline: 'Leverage momentum — Drift Protocol',
                  explain: 'Reads SOL perpetual funding rate + price momentum. Enters 10× leveraged longs/shorts when both signals align. Now LIVE.',
                  params: '$2 collateral × 10x · TP +2% · SL -1% · Max 5min hold',
                  result: '🔴 LIVE — $25 USDC allocated on Drift',
                  isHigh: false,
                },
              ].map(({ icon, name, accentColor, tagline, explain, params, result }) => (
                <div
                  key={name}
                  className="rounded-lg p-4"
                  style={{
                    background: '#111318',
                    border: `1px solid #2a2d35`,
                    borderLeft: `3px solid ${accentColor}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{icon}</span>
                    <div>
                      <div className="font-semibold text-sm mb-0.5" style={{ color: '#e2e8f0' }}>{name}</div>
                      <div className="text-[10px] font-mono italic mb-2" style={{ color: '#64748b' }}>{tagline}</div>
                      <p className="text-xs leading-relaxed mb-2" style={{ color: '#94a3b8' }}>{explain}</p>
                      <p className="font-mono text-[11px] mb-1" style={{ color: '#64748b' }}>{params}</p>
                      <p className="text-[11px] font-mono" style={{ color: accentColor }}>{result}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Score tiers */}
            <div className="rounded-lg p-4" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4" style={{ color: '#f59e0b' }} />
                <span className="text-xs font-mono font-semibold" style={{ color: '#e2e8f0' }}>Signal Score Tiers</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { range: '55–64', label: 'WATCH', desc: 'Paper only', accent: '#64748b' },
                  { range: '65–74', label: 'MODERATE', desc: 'Small paper trade', accent: '#60a5fa' },
                  { range: '75–84', label: 'HIGH', desc: 'Active paper', accent: '#f59e0b' },
                  { range: '85+', label: 'MAX', desc: 'Live candidate', accent: '#22ff88' },
                ].map(({ range, label, desc, accent }) => (
                  <div
                    key={range}
                    className="rounded-lg p-3"
                    style={{ background: '#1a1d24', border: `1px solid #2a2d35`, borderTop: `2px solid ${accent}` }}
                  >
                    <p className="font-mono text-lg font-bold" style={{ color: accent }}>{range}</p>
                    <p className="font-mono font-semibold text-[11px] mt-0.5" style={{ color: '#e2e8f0' }}>{label}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#64748b' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTROL TAB */}
        {tab === 'control' && (
          <div className="space-y-4">
            {/* Quick Commands */}
            <div className="rounded-lg p-4" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
              <div className="text-xs font-mono font-semibold mb-0.5" style={{ color: '#e2e8f0' }}>Quick Commands</div>
              <div className="text-[10px] font-mono mb-4" style={{ color: '#64748b' }}>One-click — instantly queued to GEOFF via harness</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUICK_COMMANDS.map(qc => (
                  <button
                    key={qc.label}
                    onClick={async () => {
                      const { error: qErr } = await lifeos.from('harness_tasks').insert({
                        task_id: `GEOFF-CMD-${Date.now()}`,
                        title: qc.cmd,
                        description: `Quick command from Mission Control`,
                        owner_agent: 'geoff',
                        routed_to: 'geoff',
                        status: 'pending',
                        priority: 'high',
                        source: 'mission_control',
                      })
                      setCmdLog(prev => [{ ts: new Date().toLocaleTimeString(), cmd: qc.cmd, ok: !qErr }, ...prev.slice(0, 9)])
                    }}
                    className="p-3 text-left rounded-lg transition-all group"
                    style={{ background: '#1a1d24', border: '1px solid #2a2d35' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(34,255,136,0.3)'
                      e.currentTarget.style.background = '#1f2330'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#2a2d35'
                      e.currentTarget.style.background = '#1a1d24'
                    }}
                  >
                    <div className="font-mono font-medium text-xs" style={{ color: '#e2e8f0' }}>{qc.label}</div>
                    <div className="font-mono text-[10px] mt-1 truncate" style={{ color: '#64748b' }}>{qc.cmd.replace('GEOFF: ', '')}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Command Input */}
            <div className="rounded-lg p-4" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4" style={{ color: '#22ff88' }} />
                <span className="font-mono font-semibold text-xs" style={{ color: '#e2e8f0' }}>Command GEOFF</span>
              </div>
              <p className="text-[10px] font-mono mb-4" style={{ color: '#64748b' }}>
                Commands are written to harness_tasks and picked up by GEOFF on his next cycle.
              </p>
              {/* Terminal prompt style */}
              <div
                className="rounded-lg p-3 mb-3"
                style={{ background: '#0a0b0d', border: '1px solid #2a2d35' }}
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-sm mt-2.5" style={{ color: '#22ff88' }}>{'>'}</span>
                  <textarea
                    id="geoff-command-input"
                    name="geoff-command"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    placeholder="e.g. GEOFF: analyze SOL/USD technical setup and give entry recommendation"
                    rows={3}
                    autoComplete="off"
                    className="flex-1 bg-transparent resize-none focus:outline-none font-mono text-sm placeholder-gray-700"
                    style={{ color: '#e2e8f0' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendCommand() }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>Cmd+Enter to send · Routed to geoff agent</span>
                <button
                  onClick={sendCommand}
                  disabled={!command.trim() || cmdSending}
                  className="flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(34,255,136,0.08)',
                    border: '1px solid rgba(34,255,136,0.25)',
                    color: '#22ff88',
                  }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {cmdSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>

            {/* Command Log */}
            {cmdLog.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ background: '#111318', border: '1px solid #2a2d35' }}>
                <div className="px-4 py-2.5 border-b" style={{ borderColor: '#2a2d35' }}>
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#64748b' }}>Command Log</span>
                </div>
                <div style={{ background: '#0a0b0d' }}>
                  {cmdLog.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-2.5"
                      style={{ borderBottom: '1px solid rgba(42,45,53,0.5)' }}
                    >
                      {entry.ok
                        ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#22ff88' }} />
                        : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ff3366' }} />}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs" style={{ color: '#94a3b8' }}>{entry.cmd}</div>
                        <div className="font-mono text-[10px] mt-0.5" style={{ color: '#64748b' }}>{entry.ts}</div>
                      </div>
                      <span
                        className="font-mono text-[10px] font-bold uppercase"
                        style={{ color: entry.ok ? '#22ff88' : '#ff3366' }}
                      >
                        {entry.ok ? 'queued' : 'failed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning */}
            <div
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'rgba(245,158,11,0.7)' }}>
                Commands are queued in harness_tasks with owner_agent=geoff. GEOFF will process them on his next active cycle. High priority commands are processed first.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Axiom-style Signal Row ────────────────────────────────────────────────────

function AxiomSignalRow({
  sig,
  rank,
  onAction,
  actioning,
  compact = false,
}: {
  sig: XenaAlphaSignal
  rank: number
  onAction: (sig: XenaAlphaSignal, action: 'APPROVED' | 'REJECTED' | 'WATCHING') => void
  actioning: boolean
  compact?: boolean
}) {
  if (compact) {
    // Compact overview mode: full card with info
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
        style={{ borderBottom: '1px solid rgba(42,45,53,0.5)' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1a1d24')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="font-mono text-[10px] w-5 text-right flex-shrink-0" style={{ color: '#64748b' }}>{rank}</span>
        <span className="font-mono font-bold text-xs w-20 flex-shrink-0" style={{ color: '#e2e8f0' }}>{sig.token_symbol}</span>
        {sig.score != null && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0 ${scoreColor(sig.score)}`}
          >
            {sig.score.toFixed(0)}
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex-shrink-0 ${strengthColor(sig.signal_strength)}`}
        >
          {sig.signal_strength}
        </span>
        {sig.signal_type && (
          <span className="font-mono text-[10px] flex-shrink-0" style={{ color: '#94a3b8' }}>{sig.signal_type}</span>
        )}
        {sig.on_chain_confirmed && (
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#22ff88' }}>⛓ on-chain</span>
        )}
        <span className="font-mono text-[10px] ml-auto flex-shrink-0" style={{ color: '#64748b' }}>
          {fmtTime(sig.created_at)}
        </span>
        {sig.token_mint && (
          <a
            href={`https://birdeye.so/token/${sig.token_mint}?chain=solana`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" style={{ color: '#60a5fa' }} />
          </a>
        )}
        {sig.geoff_action && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex-shrink-0 ${actionColor(sig.geoff_action)}`}>
            {sig.geoff_action}
          </span>
        )}
      </div>
    )
  }

  // Full signals tab row
  return (
    <div
      className="transition-colors"
      style={{ borderBottom: '1px solid rgba(42,45,53,0.5)', height: '40px' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#1a1d24')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        className="grid items-center gap-0 px-3 h-full"
        style={{ gridTemplateColumns: '28px 80px 52px 90px 70px 60px 1fr 160px' }}
      >
        {/* Rank */}
        <span className="font-mono text-[10px]" style={{ color: '#64748b' }}>{rank}</span>

        {/* Token */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-xs" style={{ color: '#e2e8f0' }}>{sig.token_symbol}</span>
          {sig.token_mint && (
            <a
              href={`https://birdeye.so/token/${sig.token_mint}?chain=solana`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-2.5 h-2.5" style={{ color: '#60a5fa' }} />
            </a>
          )}
        </div>

        {/* Score chip */}
        {sig.score != null ? (
          <span
            className={`inline-flex items-center justify-center w-10 h-5 rounded-full text-[10px] font-mono font-bold border ${scoreColor(sig.score)}`}
          >
            {sig.score.toFixed(0)}
          </span>
        ) : (
          <span className="font-mono text-[10px]" style={{ color: '#64748b' }}>—</span>
        )}

        {/* Signal type */}
        <span className="font-mono text-[10px] truncate" style={{ color: '#94a3b8' }}>
          {sig.signal_type || '—'}
        </span>

        {/* Strength */}
        <span
          className={`inline-flex items-center px-1.5 h-5 rounded text-[10px] font-mono border w-fit ${strengthColor(sig.signal_strength)}`}
        >
          {sig.signal_strength || '—'}
        </span>

        {/* On-chain */}
        <span className="font-mono text-[10px]" style={{ color: sig.on_chain_confirmed ? '#22ff88' : '#2a2d35' }}>
          {sig.on_chain_confirmed ? '⛓ yes' : '—'}
        </span>

        {/* Time */}
        <span className="font-mono text-[10px]" style={{ color: '#64748b' }}>
          {fmtTime(sig.created_at)}
        </span>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-1">
          {sig.geoff_reviewed ? (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${actionColor(sig.geoff_action)}`}>
              {sig.geoff_action || 'reviewed'}
            </span>
          ) : (
            <>
              <button
                onClick={() => onAction(sig, 'APPROVED')}
                disabled={actioning}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all disabled:opacity-40"
                style={{ background: 'rgba(34,255,136,0.08)', border: '1px solid rgba(34,255,136,0.25)', color: '#22ff88' }}
              >
                APPROVE
              </button>
              <button
                onClick={() => onAction(sig, 'WATCHING')}
                disabled={actioning}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all disabled:opacity-40"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}
              >
                WATCH
              </button>
              <button
                onClick={() => onAction(sig, 'REJECTED')}
                disabled={actioning}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all disabled:opacity-40"
                style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', color: '#64748b' }}
              >
                PASS
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
