import { useEffect, useState } from 'react'
import { lifeos } from '../lib/supabase'
import { AGENTS } from '../types'
import type { HarnessTask } from '../types'
import { StatCard } from '../components/StatCard'
import { CheckSquare, Clock, AlertCircle, List } from 'lucide-react'

function agentStyle(agentName: string) {
  switch (agentName?.toLowerCase()) {
    case 'ralph': return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    case 'bob': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'geoff': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'xena': return 'text-pink-400 bg-pink-500/10 border-pink-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function statusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case 'pending': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'cancelled': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

function priorityStyle(priority: string | null) {
  switch (priority?.toLowerCase()) {
    case 'high': return 'text-red-400'
    case 'medium': return 'text-yellow-400'
    case 'low': return 'text-gray-400'
    default: return 'text-gray-500'
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

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'failed'

export function Tasks() {
  const [tasks, setTasks] = useState<HarnessTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await lifeos
          .from('harness_tasks')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw new Error(error.message)
        setTasks(data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = tasks.filter(t => {
    const statusMatch = statusFilter === 'all' || t.status === statusFilter
    const agentMatch = agentFilter === 'all' || t.owner_agent?.toLowerCase() === agentFilter.toLowerCase()
    return statusMatch && agentMatch
  })

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Loading tasks...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-700/50 border border-gray-700 flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-gray-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Harness Tasks</h2>
          <p className="text-gray-500 text-sm">Agent Task Management System</p>
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
          label="Total Tasks"
          value={tasks.length}
          icon={<List className="w-5 h-5" />}
          color="text-white"
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          icon={<AlertCircle className="w-5 h-5" />}
          color="text-yellow-400"
        />
        <StatCard
          label="In Progress"
          value={inProgressCount}
          icon={<Clock className="w-5 h-5" />}
          color="text-blue-400"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={<CheckSquare className="w-5 h-5" />}
          color="text-emerald-400"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Status:</span>
          {(['all', 'pending', 'in_progress', 'completed', 'failed'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Agent:</span>
          <button
            onClick={() => setAgentFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agentFilter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {AGENTS.map(agent => (
            <button
              key={agent.name}
              onClick={() => setAgentFilter(agent.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                agentFilter === agent.name
                  ? `${agent.bgColor} ${agent.textColor} ${agent.borderColor}`
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">All Tasks</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Showing {filtered.length} of {tasks.length} tasks
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CheckSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No tasks found</p>
            <p className="text-gray-600 text-xs mt-1">
              {statusFilter !== 'all' || agentFilter !== 'all'
                ? 'Try changing the filters'
                : 'Tasks created by agents will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(task => (
                  <tr key={task.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-gray-500 text-xs font-mono">{task.task_id || task.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-white text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${agentStyle(task.owner_agent)}`}>
                        {task.owner_agent || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle(task.status)}`}>
                        {task.status?.replace('_', ' ') || 'unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium capitalize ${priorityStyle(task.priority)}`}>
                        {task.priority || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(task.created_at)}
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
