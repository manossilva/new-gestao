import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  Building2,
  Settings,
  LogOut,
  X,
  Briefcase,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/pf', icon: <User size={18} />, label: 'PF — Pessoal' },
    ...(profile?.role === 'ramon'
      ? [{ to: '/pj1', icon: <Briefcase size={18} />, label: profile?.pj1_company_name || 'PJ1' }]
      : []),
    { to: '/pj2', icon: <Building2 size={18} />, label: 'PJ2 — Sociedade' },
    { to: '/configuracoes', icon: <Settings size={18} />, label: 'Configurações' },
  ]

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20">
            <BarChart3 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight tracking-tight">
              {profile?.company_name || 'Gestão Interna'}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">Sistema Financeiro</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all duration-150"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-purple-600/15 text-purple-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all duration-150">
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              alt={profile.name || 'User'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/30"
            />
          ) : (
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {profile?.name || 'Usuário'}
            </p>
            <p className="text-zinc-500 text-xs capitalize">{profile?.role || ''}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-zinc-600 hover:text-red-400 transition-colors duration-150 p-1 rounded-lg"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-zinc-950 border-r border-white/5 h-full fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="relative w-72 bg-zinc-950 border-r border-white/5 h-full flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
