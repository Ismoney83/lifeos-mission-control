import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  color?: string
  subtext?: string
}

export function StatCard({ label, value, icon, color = 'text-white', subtext }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
      {icon && (
        <div className="p-3 bg-gray-800 rounded-lg text-gray-400">
          {icon}
        </div>
      )}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {subtext && <p className="text-gray-500 text-xs mt-0.5">{subtext}</p>}
      </div>
    </div>
  )
}
