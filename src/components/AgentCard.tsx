import type { Agent } from '../types'

interface AgentCardProps {
  agent: Agent
  taskCount?: number
  isActive?: boolean
}

export function AgentCard({ agent, taskCount = 0, isActive = true }: AgentCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 ${agent.bgColor} ${agent.borderColor} transition-all hover:scale-[1.02]`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{agent.emoji}</span>
            <h3 className={`text-lg font-bold ${agent.textColor}`}>{agent.name}</h3>
          </div>
          <p className="text-gray-400 text-sm">{agent.role}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gray-700/50 text-gray-500 border border-gray-600/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            {isActive ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Open Tasks</span>
          <span className={`font-semibold ${agent.textColor}`}>{taskCount}</span>
        </div>
      </div>
    </div>
  )
}
