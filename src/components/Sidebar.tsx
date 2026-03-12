import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wrench, TrendingUp, Target, CheckSquare, Zap } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bob', label: 'Bob Pipeline', icon: Wrench },
  { to: '/geoff', label: 'GEOFF Trading', icon: TrendingUp },
  { to: '/xena', label: 'Xena Signals', icon: Target },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
]

export function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight">Life OS</h1>
            <p className="text-gray-500 text-xs">Mission Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">System Online</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      </div>
    </aside>
  )
}
