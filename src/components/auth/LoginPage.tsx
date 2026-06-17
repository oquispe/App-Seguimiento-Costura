import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../ui/Spinner'

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

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-line max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-lg font-semibold text-ink mb-2">Revisa tu correo</h2>
          <p className="text-ink-muted text-sm">
            Hemos enviado un enlace de confirmación a <strong>{email}</strong>.
            Confirma tu cuenta y vuelve a iniciar sesión.
          </p>
          <button
            onClick={() => { setEnviado(false); setModo('login') }}
            className="mt-6 text-brand-600 text-sm hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-line max-w-sm w-full">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-ink">Tablero de Auditorías</h1>
          <p className="text-ink-muted text-sm mt-1">Confección · CMT del Sur</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            {modo === 'login' ? 'Iniciar sesión' : 'Registrarse'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
            className="text-brand-600 hover:underline font-medium"
          >
            {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
