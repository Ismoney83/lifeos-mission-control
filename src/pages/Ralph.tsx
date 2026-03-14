import { useEffect, useState, useRef } from 'react'
import { lifeos } from '../lib/supabase'
import type { HarnessTask } from '../types'
import { RefreshCw, Send, Crown } from 'lucide-react'

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

function agentBadge(agent: string) {
  const lower = agent?.toLowerCase()
  if (lower === 'ralph') return { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.35)', color: '#a855f7' }
  if (lower === 'bob') return { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', color: '#60a5fa' }
  if (lower === 'geoff') return { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', color: '#4ade80' }
  if (lower === 'xena') return { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.35)', color: '#f472b6' }
  return { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', color: '#94a3b8' }
}

function statusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case 'pending': return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b' }
    case 'in_progress': return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa' }
    case 'completed': return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#4ade80' }
    case 'failed': return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#ef4444' }
    default: return { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
  }
}

interface CommandLog {
  id: string
  text: string
  timestamp: Date
  status: 'sending' | 'sent' | 'error'
}

const COMMAND_GROUPS = [
  {
    label: 'Morning / Daily',
    commands: [
      'Morning briefing — summarize all agent activity from last 24h',
      'End of day report — compile daily summary and send to Jeremy',
      'Weekly digest — compile 7-day performance review',
    ],
  },
  {
    label: 'Agent Status',
    commands: [
      'Check Bob — pull OVB pipeline status and pending estimates',
      'Check GEOFF — report open positions, signals, and PnL',
      'Check Xena — report content scheduled and alpha signals found',
      'Full system status — check all agents and report',
    ],
  },
  {
    label: 'Task Management',
    commands: [
      'Clear completed tasks — archive all completed harness tasks',
      'Prioritize queue — review pending tasks and reorder by urgency',
      'Route backlog — assign any unassigned tasks to correct agents',
    ],
  },
  {
    label: 'Communication',
    commands: [
      'Send Telegram update — push current status to @Ralphie109_bot',
      'Draft client email — compose update email for pending estimates',
    ],
  },
]

export function Ralph() {
  const [tasks, setTasks] = useState<HarnessTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [commandLog, setCommandLog] = useState<CommandLog[]>([])
  const [customCommand, setCustomCommand] = useState('')
  const [sendingCustom, setSendingCustom] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  async function fetchTasks(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const { data } = await lifeos
      .from('harness_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setTasks(data || [])
    if (isRefresh) setRefreshing(false)
    else setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commandLog])

  async function sendCommand(title: string) {
    const logEntry: CommandLog = {
      id: `log-${Date.now()}`,
      text: title,
      timestamp: new Date(),
      status: 'sending',
    }
    setCommandLog(prev => [...prev.slice(-9), logEntry])

    const { error } = await lifeos.from('harness_tasks').insert({
      task_id: `RALPH-CMD-${Date.now()}`,
      title,
      description: 'Command from Mission Control',
      owner_agent: 'ralph',
      routed_to: 'ralph',
      status: 'pending',
      priority: 'high',
    })

    setCommandLog(prev =>
      prev.map(e => e.id === logEntry.id ? { ...e, status: error ? 'error' : 'sent' } : e)
    )

    if (!error) {
      await fetchTasks(true)
    }
  }

  async function sendCustomCommand() {
    const text = customCommand.trim()
    if (!text) return
    setSendingCustom(true)
    setCustomCommand('')
    await sendCommand(text)
    setSendingCustom(false)
  }

  const ralphTasks = tasks.filter(t => t.owner_agent?.toLowerCase() === 'ralph')
  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  const PURPLE = '#a855f7'
  const PURPLE_DIM = 'rgba(168,85,247,0.15)'
  const PURPLE_BORDER = 'rgba(168,85,247,0.25)'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: '#0d0e13' }}>
        <div className="flex items-center gap-3" style={{ color: '#64748b' }}>
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: PURPLE, borderTopColor: 'transparent' }}
          />
          <span className="text-sm">Loading Ralph...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#0d0e13', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ background: 'linear-gradient(90deg, #a855f7, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Ralph 👔
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Chief of Staff · @Ralphie109_bot
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}` }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: PURPLE }} />
          <span className="text-xs font-semibold tracking-wider" style={{ color: PURPLE }}>ONLINE</span>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Tasks', value: tasks.length },
          { label: "Ralph's Tasks", value: ralphTasks.length },
          { label: 'Pending', value: pendingCount },
          { label: 'Completed', value: completedCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              background: '#111318',
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${PURPLE}`,
            }}
          >
            <div className="text-[10px] uppercase tracking-wider font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {label}
            </div>
            <div className="text-2xl font-bold" style={{ color: PURPLE }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Command Center ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4" style={{ color: PURPLE }} />
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Command Center
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Command Groups */}
          <div className="space-y-4">
            {COMMAND_GROUPS.map(group => (
              <div
                key={group.label}
                className="rounded-xl overflow-hidden"
                style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {group.label}
                  </p>
                </div>
                <div className="p-3 space-y-1.5">
                  {group.commands.map(cmd => (
                    <button
                      key={cmd}
                      onClick={() => sendCommand(cmd)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-100"
                      style={{
                        background: 'rgba(168,85,247,0.04)',
                        border: '1px solid rgba(168,85,247,0.12)',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(168,85,247,0.12)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(168,85,247,0.35)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(168,85,247,0.04)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(168,85,247,0.12)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'
                      }}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Command + Log */}
          <div className="space-y-4">
            {/* Custom command input */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Custom Command
                </p>
              </div>
              <div className="p-4">
                <div
                  className="flex items-start gap-2 rounded-lg p-3"
                  style={{ background: '#0a0b0f', border: '1px solid rgba(168,85,247,0.2)', fontFamily: 'monospace' }}
                >
                  <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: PURPLE }}>{'>'}</span>
                  <textarea
                    value={customCommand}
                    onChange={e => setCustomCommand(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendCustomCommand()
                      }
                    }}
                    placeholder="Type a command for Ralph..."
                    rows={3}
                    className="flex-1 bg-transparent resize-none text-sm focus:outline-none"
                    style={{ color: 'rgba(255,255,255,0.85)', caretColor: PURPLE }}
                  />
                </div>
                <button
                  onClick={sendCustomCommand}
                  disabled={!customCommand.trim() || sendingCustom}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: customCommand.trim() ? 'linear-gradient(90deg, #7B2FBE, #a855f7)' : 'rgba(168,85,247,0.1)',
                    color: customCommand.trim() ? '#fff' : 'rgba(168,85,247,0.4)',
                    cursor: customCommand.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingCustom ? 'Sending...' : 'Send Command'}
                </button>
              </div>
            </div>

            {/* Command Log */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Command Log
                </p>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  last {Math.min(commandLog.length, 10)}
                </span>
              </div>
              <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto" style={{ fontFamily: 'monospace' }}>
                {commandLog.length === 0 ? (
                  <p className="text-xs px-1 py-4 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    No commands sent yet
                  </p>
                ) : (
                  commandLog.slice(-10).map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="flex-shrink-0 mt-0.5"
                        style={{
                          color: entry.status === 'sending' ? '#f59e0b'
                            : entry.status === 'error' ? '#ef4444'
                            : '#4ade80',
                        }}
                      >
                        {entry.status === 'sending' ? '⟳' : entry.status === 'error' ? '✗' : '✓'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{entry.text}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {entry.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Activity Table ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Recent Activity — All Agents
          </p>
          <button
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.2)',
              color: PURPLE,
            }}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Table header */}
          <div
            className="grid px-4 py-2 text-[10px] font-mono uppercase tracking-wider"
            style={{
              gridTemplateColumns: '120px 1fr 80px 90px 70px 80px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.2)',
            }}
          >
            <span>Task ID</span>
            <span>Title</span>
            <span>Agent</span>
            <span>Status</span>
            <span>Priority</span>
            <span className="text-right">Created</span>
          </div>

          {/* Rows */}
          {tasks.slice(0, 20).length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
              No tasks found
            </div>
          ) : (
            tasks.slice(0, 20).map(task => {
              const ab = agentBadge(task.owner_agent)
              const sb = statusBadge(task.status)
              return (
                <div
                  key={task.id}
                  className="grid px-4 py-2.5 transition-colors items-center"
                  style={{
                    gridTemplateColumns: '120px 1fr 80px 90px 70px 80px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="font-mono text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {task.task_id?.slice(0, 14) || task.id?.slice(0, 8)}
                  </span>
                  <span className="text-xs truncate pr-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {(task.title || '').slice(0, 50)}
                  </span>
                  <span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
                      style={{ background: ab.bg, border: `1px solid ${ab.border}`, color: ab.color }}
                    >
                      {task.owner_agent || '—'}
                    </span>
                  </span>
                  <span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: sb.bg, border: `1px solid ${sb.border}`, color: sb.color }}
                    >
                      {task.status}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {task.priority || '—'}
                  </span>
                  <span className="text-[10px] font-mono text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {formatRelativeTime(task.created_at)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
