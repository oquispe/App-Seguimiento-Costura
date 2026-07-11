import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LoginPage } from './components/auth/LoginPage'
import { AppShell } from './components/shell/AppShell'
import { Spinner } from './components/ui/Spinner'
import { modulos, RUTA_POR_DEFECTO } from './modules/registry'
import { FormatoInstalacionPage } from './modules/requerimiento-maquina/pages/FormatoInstalacionPage'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <Route element={<AppShell />}>
            {modulos.map((modulo) => (
              <Route key={modulo.id} path={modulo.path} element={<modulo.Component />} />
            ))}
            <Route path="/costura/requerimiento-maquina/formato/:formatoKey" element={<FormatoInstalacionPage />} />
            <Route path="*" element={<Navigate to={RUTA_POR_DEFECTO} replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  )
}
