import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wrench, TrendingUp, Sparkles, CheckSquare, Zap, Menu, X, Crown } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard',      icon: LayoutDashboard, color: '#94a3b8', dot: '#94a3b8' },
  { to: '/ralph', label: 'Ralph',     icon: Crown,           color: '#a855f7', dot: '#a855f7' },
  { to: '/bob',  label: 'Bob Pipeline',  icon: Wrench,          color: '#4573D2', dot: '#4573D2' },
  { to: '/geoff',label: 'GEOFF Trading', icon: TrendingUp,      color: '#22C55E', dot: '#22C55E' },
  { to: '/xena', label: 'Xena Hub',      icon: Sparkles,        color: '#A855F7', dot: '#A855F7' },
  { to: '/tasks',label: 'Tasks',         icon: CheckSquare,     color: '#F59E0B', dot: '#F59E0B' },
]

const SIDEBAR_BG   = '#13141a'
const SIDEBAR_BORD = 'rgba(255,255,255,0.06)'

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <div className="space-y-0.5">
      {navItems.map(({ to, label, icon: Icon, color, dot }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onClick}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* Left active indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: color }}
                />
              )}
              {/* Colored dot when inactive */}
              {!isActive && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-50 group-hover:opacity-80 transition-opacity"
                  style={{ background: dot }} />
              )}
              {isActive && (
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
              )}
              {!isActive && (
                <Icon className="w-4 h-4 flex-shrink-0 opacity-60 group-hover:opacity-90" />
              )}
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: `1px solid ${SIDEBAR_BORD}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7B2FBE 0%, #07B9CE 100%)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight tracking-tight">Life OS</h1>
            <p className="text-xs mt-px" style={{ color: 'rgba(255,255,255,0.35)' }}>Mission Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          Workspace
        </p>
        <NavItems onClick={onNav} />
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: `1px solid ${SIDEBAR_BORD}` }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            All systems online
          </span>
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:flex w-56 min-h-screen flex-col flex-shrink-0"
        style={{ background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORD}` }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 h-14"
        style={{ background: SIDEBAR_BG, borderBottom: `1px solid ${SIDEBAR_BORD}` }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7B2FBE 0%, #07B9CE 100%)' }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">Life OS</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Online</span>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full z-50 w-64 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORD}` }}
      >
        <div className="flex items-center justify-between px-5 py-5"
          style={{ borderBottom: `1px solid ${SIDEBAR_BORD}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7B2FBE 0%, #07B9CE 100%)' }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">Life OS</h1>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Mission Control</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            Workspace
          </p>
          <NavItems onClick={() => setOpen(false)} />
        </nav>
        <div className="p-4" style={{ borderTop: `1px solid ${SIDEBAR_BORD}` }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>All systems online</span>
          </div>
        </div>
      </aside>
    </>
  )
}
