import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAreas } from '../../modules/registry'
import { cn } from '../../lib/utils'

function ButtonSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  )
}

function HeroPanel() {
  const modulos = getAreas().flatMap((area) => area.modulos)

  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-10 text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ backgroundImage: 'radial-gradient(circle at 15% 10%, white 0, transparent 45%)' }}
      />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold backdrop-blur-sm">
          CS
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">CMT del Sur</p>
          <p className="text-xs text-white/70">Sistema de gestión</p>
        </div>
      </div>

      <div className="relative space-y-7">
        <h1 className="text-3xl font-bold leading-tight text-balance">
          Control total de producción, en un solo lugar.
        </h1>
        <p className="max-w-sm text-sm text-white/75">
          Auditorías, requerimientos de máquina y firmas digitales, sin salir del sistema.
        </p>
        <div className="space-y-3 pt-2">
          {modulos.map((modulo) => {
            const Icon = modulo.icon
            return (
              <div
                key={modulo.id}
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm"
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-sm font-medium">{modulo.nombre}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="relative text-xs text-white/50">© {new Date().getFullYear()} CMT del Sur</p>
    </div>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setEnviado(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <HeroPanel />

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-xl shadow-slate-900/5"
        >
          {enviado ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-ink">Revisa tu correo</h2>
              <p className="text-sm text-ink-muted">
                Hemos enviado un enlace de confirmación a <strong>{email}</strong>. Confirma tu cuenta y vuelve a
                iniciar sesión.
              </p>
              <button
                onClick={() => {
                  setEnviado(false)
                  setModo('login')
                }}
                className="mt-6 text-sm font-medium text-brand-600 hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 lg:hidden">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-700/20">
                    CS
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-ink">CMT del Sur</p>
                    <p className="text-xs text-ink-faint">Sistema de gestión</p>
                  </div>
                </div>
              </div>

              <div className="mb-2 hidden lg:block">
                <h2 className="text-lg font-bold text-ink">Bienvenido de nuevo</h2>
                <p className="text-sm text-ink-muted">Ingresa tus credenciales para continuar</p>
              </div>

              <div className="mb-6 mt-4 flex rounded-xl bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-150',
                    modo === 'login' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => setModo('registro')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-150',
                    modo === 'registro' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  Crear cuenta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Correo electrónico</label>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-line py-2.5 pl-9 pr-3 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-line py-2.5 pl-9 pr-3 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-700/20 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-700/30 disabled:translate-y-0 disabled:opacity-50"
                >
                  {loading ? <ButtonSpinner /> : <ArrowRight size={16} />}
                  {modo === 'login' ? 'Iniciar sesión' : 'Registrarse'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
