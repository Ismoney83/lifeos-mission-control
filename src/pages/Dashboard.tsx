import { useEffect, useState } from 'react'
import { lifeos, ovb } from '../lib/supabase'
import { AGENTS } from '../types'
import type { HarnessTask, XenaAlphaSignal, Estimate } from '../types'
import { CheckSquare, DollarSign, Zap, Clock, Wrench, Target, BarChart2 } from 'lucide-react'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Agent-specific design configs
const AGENT_CONFIG = {
  Ralph: {
    bg: '#13111f',
    border: 'rgba(168,85,247,0.15)',
    accentBorder: '#7B2FBE',
    accent: '#a855f7',
    icon: '👔',
    tagline: 'Chief of Staff',
    style: 'chief',
  },
  Bob: {
    bg: '#0f1520',
    border: 'rgba(69,115,210,0.15)',
    accentBorder: '#4573D2',
    accent: '#4573D2',
    icon: '🔧',
    tagline: 'Construction PM',
    style: 'construction',
  },
  GEOFF: {
    bg: '#0a0f0a',
    border: 'rgba(34,197,94,0.12)',
    accentBorder: '#22C55E',
    accent: '#22ff88',
    icon: '📈',
    tagline: 'Trading Terminal',
    style: 'trading',
  },
  Xena: {
    bg: '#130f1f',
    border: 'rgba(168,85,247,0.12)',
    accentBorder: '#A855F7',
    accent: '#c084fc',
    icon: '✨',
    tagline: 'Content Engine',
    style: 'content',
  },
}

export function Dashboard() {
  const [tasks, setTasks] = useState<HarnessTask[]>([])
  const [signals, setSignals] = useState<XenaAlphaSignal[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [tasksRes, signalsRes, estimatesRes] = await Promise.all([
          lifeos.from('harness_tasks').select('*').order('created_at', { ascending: false }),
          lifeos.from('xena_alpha_signals').select('*').order('created_at', { ascending: false }).limit(8),
          ovb.from('estimates').select('*').order('created_at', { ascending: false }),
        ])
        if (tasksRes.error) throw new Error(`Tasks: ${tasksRes.error.message}`)
        if (signalsRes.error) throw new Error(`Signals: ${signalsRes.error.message}`)
        if (estimatesRes.error) throw new Error(`Estimates: ${estimatesRes.error.message}`)
        setTasks(tasksRes.data || [])
        setSignals(signalsRes.data || [])
        setEstimates(estimatesRes.data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const tasksByAgent = AGENTS.reduce((acc, agent) => {
    acc[agent.name] = tasks.filter(
      t => t.owner_agent?.toLowerCase() === agent.name.toLowerCase() && t.status !== 'completed'
    ).length
    return acc
  }, {} as Record<string, number>)

  const taskStatusCounts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  const activeEstimates = estimates.filter(e => !e.is_archived && e.status !== 'rejected')
  const pipelineValue = activeEstimates.reduce((sum, e) => sum + (e.total || 0), 0)
  const approvedValue = estimates.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.total || 0), 0)
  const estimatesByStatus = {
    draft: estimates.filter(e => e.status === 'draft').length,
    sent: estimates.filter(e => e.status === 'sent').length,
    approved: estimates.filter(e => e.status === 'approved').length,
  }
  const strongSignals = signals.filter(s => s.signal_strength?.toUpperCase() === 'STRONG').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: '#0d0e13' }}>
        <div className="flex items-center gap-3" style={{ color: '#64748b' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#7B2FBE', borderTopColor: 'transparent' }} />
          <span className="text-sm">Loading Mission Control...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#0d0e13', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Mission Control</h2>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Life OS · All systems operational
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* ── System Metrics ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Tasks', value: tasks.length, icon: <CheckSquare className="w-4 h-4" />, accent: '#94a3b8', mono: false },
          { label: 'In Progress', value: taskStatusCounts.in_progress, icon: <Clock className="w-4 h-4" />, accent: '#f59e0b', mono: false },
          { label: 'Alpha Signals', value: signals.length, icon: <Zap className="w-4 h-4" />, accent: '#c084fc', mono: false },
          { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, accent: '#22ff88', mono: true },
        ].map(({ label, value, icon, accent, mono }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              background: '#111318',
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {label}
              </span>
              <span style={{ color: accent }}>{icon}</span>
            </div>
            <div className={`text-2xl font-bold ${mono ? 'font-mono' : ''}`} style={{ color: accent }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Agent Cards (4 distinct design styles) ── */}
      <section>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Active Agents
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {AGENTS.map(agent => {
            const cfg = AGENT_CONFIG[agent.name as keyof typeof AGENT_CONFIG]
            const taskCount = tasksByAgent[agent.name] || 0
            const isActive = agent.name !== 'Ralph'
            return (
              <div
                key={agent.name}
                className="rounded-xl p-4 transition-all duration-150 cursor-default"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderTop: `2px solid ${cfg.accentBorder}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.accentBorder)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = cfg.border)}
              >
                {/* Agent header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{cfg.icon}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{agent.name}</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{cfg.tagline}</div>
                    </div>
                  </div>
                  {/* Status dot */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
                      style={{ background: isActive ? cfg.accent : 'rgba(255,255,255,0.2)' }}
                    />
                    <span className="text-[10px]" style={{ color: isActive ? cfg.accent : 'rgba(255,255,255,0.25)' }}>
                      {isActive ? 'Active' : 'Idle'}
                    </span>
                  </div>
                </div>

                {/* Agent-specific content */}
                {agent.name === 'Bob' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Open tasks</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{taskCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Pipeline</span>
                      <span className="font-mono font-bold" style={{ color: '#22ff88' }}>${pipelineValue.toLocaleString()}</span>
                    </div>
                    {/* Progress bar — Asana style */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <span>{estimatesByStatus.approved} approved</span>
                        <span>{estimates.length} total</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: estimates.length > 0 ? `${Math.round(estimatesByStatus.approved / estimates.length * 100)}%` : '0%',
                            background: 'linear-gradient(90deg, #4573D2, #37C68B)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {agent.name === 'GEOFF' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Open tasks</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{taskCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Strong signals</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{strongSignals}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{ background: 'rgba(34,255,136,0.08)', border: '1px solid rgba(34,255,136,0.2)', color: '#22ff88' }}
                      >
                        LIVE
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Drift · Jupiter</span>
                    </div>
                  </div>
                )}

                {agent.name === 'Xena' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Open tasks</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{taskCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Alpha signals</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{signals.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c084fc' }}
                      >
                        Content + Alpha
                      </span>
                    </div>
                  </div>
                )}

                {agent.name === 'Ralph' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Open tasks</span>
                      <span className="font-mono font-bold" style={{ color: cfg.accent }}>{taskCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', color: 'rgba(168,85,247,0.7)' }}
                      >
                        Telegram · @Ralphie109_bot
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Bottom Row: Signals + Pipeline ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Alpha Signals — Axiom-style dense rows */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Latest Alpha Signals
            </p>
            <span className="text-xs font-mono" style={{ color: '#c084fc' }}>
              {strongSignals} strong · {signals.length} total
            </span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}>
            {signals.length === 0 ? (
              <div className="p-8 text-center">
                <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.08)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>No signals yet</p>
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div className="grid px-4 py-2 border-b text-[10px] font-mono uppercase tracking-wider"
                  style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)',
                    gridTemplateColumns: '1fr 70px 80px 60px' }}>
                  <span>Token</span>
                  <span>Score</span>
                  <span>Strength</span>
                  <span className="text-right">Time</span>
                </div>
                {signals.map(signal => {
                  const score = signal.score
                  const scoreC = score == null ? '#64748b' : score >= 75 ? '#22ff88' : score >= 60 ? '#f59e0b' : '#ef4444'
                  const strengthC = signal.signal_strength?.toUpperCase() === 'STRONG'
                    ? '#22ff88' : signal.signal_strength?.toUpperCase() === 'MEDIUM'
                    ? '#f59e0b' : '#ef4444'
                  return (
                    <div
                      key={signal.id}
                      className="grid px-4 py-2.5 transition-colors"
                      style={{
                        gridTemplateColumns: '1fr 70px 80px 60px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <span className="font-mono font-bold text-xs text-white">{signal.token_symbol}</span>
                        {signal.on_chain_confirmed && (
                          <span className="ml-2 text-[10px] font-mono" style={{ color: '#22ff88' }}>⛓</span>
                        )}
                      </div>
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: scoreC }}
                      >
                        {score != null ? score.toFixed(0) : '—'}
                      </span>
                      <span
                        className="font-mono text-[10px] font-medium"
                        style={{ color: strengthC }}
                      >
                        {signal.signal_strength || '—'}
                      </span>
                      <span className="font-mono text-[10px] text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {formatRelativeTime(signal.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* OVB Pipeline — Asana-style */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              OVB Construction Pipeline
            </p>
            <span className="text-xs" style={{ color: '#4573D2' }}>{estimates.length} estimates</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Pipeline value hero */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Active Pipeline
                  </p>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#22ff88' }}>
                    ${pipelineValue.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Approved
                  </p>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#37C68B' }}>
                    ${approvedValue.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: estimates.length > 0 ? `${Math.round(estimatesByStatus.approved / estimates.length * 100)}%` : '0%',
                      background: 'linear-gradient(90deg, #4573D2 0%, #37C68B 100%)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <span>{Math.round(estimates.length > 0 ? estimatesByStatus.approved / estimates.length * 100 : 0)}% close rate</span>
                  <span>{estimatesByStatus.approved} of {estimates.length} approved</span>
                </div>
              </div>
            </div>

            {/* Status breakdown — Asana section headers */}
            <div className="px-5 py-3 space-y-2.5">
              {[
                { label: 'Draft', count: estimatesByStatus.draft, icon: <Wrench className="w-3.5 h-3.5" />, color: '#94a3b8' },
                { label: 'Sent to Client', count: estimatesByStatus.sent, icon: <Target className="w-3.5 h-3.5" />, color: '#4573D2' },
                { label: 'Approved', count: estimatesByStatus.approved, icon: <BarChart2 className="w-3.5 h-3.5" />, color: '#37C68B' },
              ].map(({ label, count, icon, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span style={{ color }}>{icon}</span>
                  <span className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span className="font-mono font-bold text-xs" style={{ color }}>{count}</span>
                  {/* Mini bar */}
                  <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: estimates.length > 0 ? `${Math.round(count / estimates.length * 100)}%` : '0%',
                        background: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Task breakdown */}
            <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Harness Tasks
              </p>
              <div className="flex items-center gap-3">
                {[
                  { label: 'Pending', count: taskStatusCounts.pending, color: '#f59e0b' },
                  { label: 'Active', count: taskStatusCounts.in_progress, color: '#4573D2' },
                  { label: 'Done', count: taskStatusCounts.completed, color: '#37C68B' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex-1 text-center rounded-lg py-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="font-mono font-bold text-base" style={{ color }}>{count}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
