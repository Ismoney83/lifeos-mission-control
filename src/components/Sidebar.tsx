import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wrench, TrendingUp, Target, CheckSquare, Zap, Menu, X } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bob', label: 'Bob Pipeline', icon: Wrench },
  { to: '/geoff', label: 'GEOFF Trading', icon: TrendingUp },
  { to: '/xena', label: 'Xena Hub', icon: Target },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
]

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <>
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`
          }
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  )
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t border-gray-800">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs text-gray-500">System Online</span>
      </div>
      <p className="text-xs text-gray-600 mt-1">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })}
      </p>
    </div>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── DESKTOP: permanent sidebar ── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">Life OS</h1>
              <p className="text-gray-500 text-xs">Mission Control</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItems />
        </nav>
        <SidebarFooter />
      </aside>

      {/* ── MOBILE: top header bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 border-b border-gray-800 flex items-center px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">Life OS</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">Online</span>
        </div>
      </div>

      {/* ── MOBILE: slide-in drawer backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── MOBILE: slide-in drawer ── */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">Life OS</h1>
              <p className="text-gray-500 text-xs">Mission Control</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItems onClick={() => setOpen(false)} />
        </nav>
        <SidebarFooter />
      </aside>
    </>
  )
}
