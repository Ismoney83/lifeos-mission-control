import { useEffect, useState } from 'react'
import { lifeos, ovb } from '../lib/supabase'
import { AGENTS } from '../types'
import type { HarnessTask, XenaAlphaSignal, Estimate } from '../types'
import { AgentCard } from '../components/AgentCard'
import { StatCard } from '../components/StatCard'
import { CheckSquare, TrendingUp, DollarSign, Zap, Clock } from 'lucide-react'

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

function signalStrengthColor(strength: string) {
  switch (strength?.toUpperCase()) {
    case 'STRONG': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'WEAK': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
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
          lifeos.from('xena_alpha_signals').select('*').order('created_at', { ascending: false }).limit(5),
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
  const estimatesByStatus = {
    draft: estimates.filter(e => e.status === 'draft').length,
    sent: estimates.filter(e => e.status === 'sent').length,
    approved: estimates.filter(e => e.status === 'approved').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Loading dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Mission Control</h2>
        <p className="text-gray-500 text-sm mt-1">Life OS System Overview</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          Error loading data: {error}
        </div>
      )}

      {/* Agent Cards */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Agents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {AGENTS.map(agent => (
            <AgentCard
              key={agent.name}
              agent={agent}
              taskCount={tasksByAgent[agent.name] || 0}
              isActive={agent.name !== 'Ralph'}
            />
          ))}
        </div>
      </section>

      {/* Stats Row */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">System Metrics</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Tasks"
            value={tasks.length}
            icon={<CheckSquare className="w-5 h-5" />}
            color="text-white"
          />
          <StatCard
            label="In Progress"
            value={taskStatusCounts.in_progress}
            icon={<Clock className="w-5 h-5" />}
            color="text-yellow-400"
          />
          <StatCard
            label="Alpha Signals"
            value={signals.length}
            icon={<Zap className="w-5 h-5" />}
            color="text-pink-400"
          />
          <StatCard
            label="Pipeline Value"
            value={`$${pipelineValue.toLocaleString()}`}
            icon={<DollarSign className="w-5 h-5" />}
            color="text-emerald-400"
          />
        </div>
      </section>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Latest Signals */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Latest Alpha Signals</h3>
            <span className="text-xs text-pink-400">{signals.length} total</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {signals.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No signals yet</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {signals.map(signal => (
                  <div key={signal.id} className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-pink-500/10 border border-pink-500/20 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-pink-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{signal.token_symbol}</p>
                        <p className="text-gray-500 text-xs">{signal.source_account || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${signalStrengthColor(signal.signal_strength)}`}>
                        {signal.signal_strength}
                      </span>
                      <span className="text-gray-600 text-xs">{formatRelativeTime(signal.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* OVB Pipeline Summary */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">OVB Pipeline</h3>
            <span className="text-xs text-blue-400">{estimates.length} estimates</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Draft', count: estimatesByStatus.draft, color: 'text-gray-400' },
                { label: 'Sent', count: estimatesByStatus.sent, color: 'text-blue-400' },
                { label: 'Approved', count: estimatesByStatus.approved, color: 'text-emerald-400' },
              ].map(({ label, count, color }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{count}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Active Pipeline Value</span>
                <span className="text-emerald-400 font-bold">${pipelineValue.toLocaleString()}</span>
              </div>
            </div>
            {/* Tasks breakdown */}
            <div className="border-t border-gray-800 pt-4 space-y-2">
              {[
                { label: 'Pending', count: taskStatusCounts.pending, color: 'bg-yellow-500' },
                { label: 'In Progress', count: taskStatusCounts.in_progress, color: 'bg-blue-500' },
                { label: 'Completed', count: taskStatusCounts.completed, color: 'bg-emerald-500' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-gray-400 text-xs flex-1">{label}</span>
                  <span className="text-white text-xs font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
