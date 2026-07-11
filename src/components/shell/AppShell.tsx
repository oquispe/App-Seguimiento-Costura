import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Dialog } from 'radix-ui'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAreas } from '../../modules/registry'
import { cn } from '../../lib/utils'

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
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

function NavAreas({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const areas = getAreas()
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
      {areas.map((area) => (
        <div key={area.area}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {area.area}
            </p>
          )}
          <div className="space-y-0.5">
            {area.modulos.map((modulo) => {
              const Icon = modulo.icon
              return (
                <NavLink
                  key={modulo.id}
                  to={modulo.path}
                  onClick={onNavigate}
                  title={collapsed ? modulo.nombre : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-muted hover:bg-surface hover:text-ink'
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{modulo.nombre}</span>}
                </NavLink>
              )
            })}
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

  return (
    <div className="shrink-0 border-t border-line p-2">
      <div className={cn('flex items-center gap-2 rounded-lg px-2 py-2', !collapsed && 'justify-between')}>
        {!collapsed && (
          <p className="min-w-0 truncate text-xs text-ink-muted" title={email ?? undefined}>
            {email ?? ' '}
          </p>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          title="Cerrar sesión"
          className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} />
        </button>
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
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-[width] duration-150 md:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <Logo collapsed={collapsed} />
        <NavAreas collapsed={collapsed} />
        <UserFooter collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-line py-2 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      {/* Sidebar móvil (overlay) */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl md:hidden">
            <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <span className="text-sm font-semibold text-ink">CMT del Sur</span>
              <Dialog.Close className="text-ink-faint hover:text-ink">
                <X size={18} />
              </Dialog.Close>
            </div>
            <NavAreas collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <UserFooter collapsed={false} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Contenido del módulo activo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-line bg-white px-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center rounded-lg p-1.5 text-ink-muted hover:bg-surface"
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
