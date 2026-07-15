import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Dialog } from 'radix-ui'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAreas } from '../../modules/registry'
import { cn } from '../../lib/utils'

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-700/20">
        CS
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">CMT del Sur</p>
          <p className="truncate text-xs text-ink-faint">Sistema de gestión</p>
        </div>
      )}
    </div>
  )
}

function IconChip({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
        active ? 'bg-white/15 text-white' : 'bg-slate-100 text-ink-muted'
      )}
    >
      <Icon size={16} />
    </span>
  )
}

function NavAreas({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const areas = getAreas()
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 scrollbar-thin">
      {areas.map((area) => (
        <div key={area.area}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {area.area}
            </p>
          )}
          <div className="space-y-1">
            {area.modulos.map((modulo) => (
              <NavLink key={modulo.id} to={modulo.path} onClick={onNavigate} title={collapsed ? modulo.nombre : undefined}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      'relative flex items-center gap-3 overflow-hidden rounded-xl px-2 py-2 text-sm font-medium transition-colors duration-150',
                      isActive ? 'text-white' : 'text-ink-muted hover:bg-surface hover:text-ink'
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-700/30"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative z-10 flex min-w-0 items-center gap-3">
                      <IconChip Icon={modulo.icon} active={isActive} />
                      {!collapsed && <span className="truncate">{modulo.nombre}</span>}
                    </span>
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function UserFooter({ collapsed }: { collapsed: boolean }) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const initial = email ? email[0]!.toUpperCase() : '?'

  return (
    <div className="shrink-0 border-t border-line p-2">
      <div className={cn('flex items-center gap-2 rounded-xl px-1.5 py-1.5', !collapsed && 'justify-between')}>
        <div className={cn('flex min-w-0 items-center gap-2', collapsed && 'justify-center')}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-semibold text-ink-muted">
            {initial}
          </span>
          {!collapsed && (
            <p className="min-w-0 truncate text-xs text-ink-muted" title={email ?? undefined}>
              {email ?? ' '}
            </p>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => supabase.auth.signOut()}
            title="Cerrar sesión"
            className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-ink-faint transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar de escritorio */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white shadow-sm transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <Logo collapsed={collapsed} />
        <NavAreas collapsed={collapsed} />
        <UserFooter collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-line py-2 text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      {/* Sidebar móvil (overlay animado) */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <AnimatePresence>
          {mobileOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl md:hidden"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                >
                  <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title>
                  <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-700/20">
                        CS
                      </div>
                      <span className="text-sm font-semibold text-ink">CMT del Sur</span>
                    </div>
                    <Dialog.Close className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface hover:text-ink">
                      <X size={18} />
                    </Dialog.Close>
                  </div>
                  <NavAreas collapsed={false} onNavigate={() => setMobileOpen(false)} />
                  <UserFooter collapsed={false} />
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* Contenido del módulo activo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-line bg-white/90 px-3 shadow-sm backdrop-blur-sm md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface"
          >
            <Menu size={20} />
          </button>
          <span className="ml-2 text-sm font-semibold text-ink">CMT del Sur</span>
        </div>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
