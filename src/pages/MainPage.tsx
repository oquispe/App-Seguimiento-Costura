import { useState, useCallback, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Upload, BarChart3, Users, Download, LogOut, Wand2, Cloud, RefreshCw, MessageCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { publicarCargaActual, leerCargaActual, guardarSnapshot, actualizarStatusCortes, leerUltimaActualizacion } from '../lib/cargaActual'
import { diasRestantes, calcularSemaforo } from '../lib/parsers/dateUtils'
import { DropZone } from '../components/upload/DropZone'
import { PanelDiagnostico } from '../components/upload/DiagnosticoCruce'
import { KPICards, calcularKPIs } from '../components/dashboard/KPICards'
import { CumplimientoPorPersona } from '../components/dashboard/CumplimientoPorPersona'
import { TablaPrincipal } from '../components/table/TablaPrincipal'
import { PanelFiltros, aplicarFiltros } from '../components/table/Filtros'
import { DrawerDetalle } from '../components/drawer/DrawerDetalle'
import { ChatBot } from '../components/chat/ChatBot'
import { useAppStore } from '../hooks/useAppStore'
import { useSeguimiento } from '../hooks/useSeguimiento'
import { parseAuditorias } from '../lib/parsers/parseAuditorias'
import { parsePgo } from '../lib/parsers/parsePgo'
import { parseCortes } from '../lib/parsers/parseCortes'
import { exportarExcel } from '../lib/exporters/exportExcel'
import { Spinner } from '../components/ui/Spinner'
import type { ItemCruzado, AuditoriaRow, PgoRow, CortesRow, ParseResult } from '../types'
import type { Filtros } from '../components/table/Filtros'

type Tab = 'dashboard' | 'carga' | 'cumplimiento'

const EMPTY_FILTROS: Filtros = {
  cliente: '', semana: '', estado: '', responsable: '', semaforo: '',
}

export function MainPage() {
  const { state, setAuditorias, setPgos, setCortes, setLlaveCruce, mergeSegimiento, setItemsDesdeNube } = useAppStore()
  const { cargarSeguimiento, cargarComentarios } = useSeguimiento()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [filtros, setFiltros] = useState<Filtros>(EMPTY_FILTROS)
  const [agruparPor, setAgruparPor] = useState<'semana' | 'cliente' | 'ninguno'>('semana')
  const [selectedItem, setSelectedItem] = useState<ItemCruzado | null>(null)
  const [loadingSeg, setLoadingSeg] = useState(false)
  const [iaResumen, setIaResumen] = useState<string | null>(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [publicadoMsg, setPublicadoMsg] = useState<string | null>(null)
  const [cargandoNube, setCargandoNube] = useState(false)
  const [fechaActualizacion, setFechaActualizacion] = useState<Date | null>(null)
  const [chatAbierto, setChatAbierto] = useState(false)
  const [cortesUpdate, setCortesUpdate] = useState<ParseResult<CortesRow> | null>(null)
  const [actualizando, setActualizando] = useState(false)
  const [actualizadoMsg, setActualizadoMsg] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Cargar email del usuario logueado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? 'Usuario'))
  }, [])

  // Al montar: leer carga_actual de Supabase (foto compartida de la semana)
  useEffect(() => {
    setCargandoNube(true)
    Promise.all([leerCargaActual(), leerUltimaActualizacion()])
      .then(([items, fecha]) => {
        if (items.length > 0) {
          const recalc = items.map((it) => {
            const diasFinal = diasRestantes(it.auditoria_final)
            return {
              ...it,
              dias_fin_entrega: diasRestantes(it.fin_entrega),
              dias_auditoria_final: diasFinal,
              semaforo: calcularSemaforo(diasFinal),
            } satisfies ItemCruzado
          })
          setItemsDesdeNube(recalc)
        }
        setFechaActualizacion(fecha)
      })
      .catch(console.error)
      .finally(() => setCargandoNube(false))
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpis = useMemo(() => calcularKPIs(state.items), [state.items])
  const itemsFiltrados = useMemo(() => aplicarFiltros(state.items, filtros), [state.items, filtros])

  const handleParsedAuditorias = useCallback(
    async (result: ParseResult<AuditoriaRow>) => {
      setAuditorias(result)
      // Cargar seguimiento de Supabase
      if (result.rows.length > 0) {
        setLoadingSeg(true)
        try {
          // Los item_keys se generan durante el cruce; por ahora cargamos tras el cruce
        } finally {
          setLoadingSeg(false)
        }
      }
    },
    [setAuditorias]
  )

  // Cargar seguimiento una vez que el cruce esté listo
  const cargarYMerge = useCallback(async () => {
    if (state.items.length === 0) return
    setLoadingSeg(true)
    try {
      const keys = state.items.map((i) => i.item_key)
      const segs = await cargarSeguimiento(keys)
      mergeSegimiento(segs.map((s) => ({
        item_key: s.item_key,
        estado: s.estado,
        resultado: s.resultado,
        fecha_solicitada: s.fecha_solicitada,
        fecha_auditoria: s.fecha_auditoria,
        solicitado_por: s.solicitado_por,
        responsable: s.responsable,
      })))
    } finally {
      setLoadingSeg(false)
    }
  }, [state.items, cargarSeguimiento, mergeSegimiento])

  const handleUpdated = useCallback((updated: ItemCruzado) => {
    mergeSegimiento([updated])
    setSelectedItem(updated)
  }, [mergeSegimiento])

  const handleExportar = useCallback(async () => {
    // Cargar todos los comentarios de los ítems visibles
    const comentarios: import('../types').ComentarioRecord[] = []
    for (const it of itemsFiltrados.slice(0, 200)) {
      const cms = await cargarComentarios(it.item_key)
      comentarios.push(...cms)
    }
    exportarExcel(itemsFiltrados, comentarios)
  }, [itemsFiltrados, cargarComentarios])

  const handlePublicar = useCallback(async () => {
    if (state.items.length === 0) return
    setPublicando(true)
    setPublicadoMsg(null)
    try {
      const { ok, error } = await publicarCargaActual(state.items, userEmail)
      if (ok) {
        // Guardar snapshot de la semana predominante
        const semanas = Array.from(new Set(state.items.map((i) => i.semana)))
        for (const s of semanas) {
          await guardarSnapshot(s, state.items.filter((i) => i.semana === s), userEmail)
        }
        setPublicadoMsg(`✓ ${state.items.length} ítems publicados para todos los usuarios`)
      } else {
        setPublicadoMsg(`Error: ${error}`)
      }
    } finally {
      setPublicando(false)
    }
  }, [state.items, userEmail])

  const handleRefrescarNube = useCallback(async () => {
    setCargandoNube(true)
    try {
      const [items, fecha] = await Promise.all([leerCargaActual(), leerUltimaActualizacion()])
      if (items.length > 0) {
        const recalc = items.map((it) => {
          const diasFinal = diasRestantes(it.auditoria_final)
          return { ...it, dias_fin_entrega: diasRestantes(it.fin_entrega), dias_auditoria_final: diasFinal, semaforo: calcularSemaforo(diasFinal) } satisfies ItemCruzado
        })
        setItemsDesdeNube(recalc)
      }
      setFechaActualizacion(fecha)
    } finally {
      setCargandoNube(false)
    }
  }, [setItemsDesdeNube])

  const handleActualizarCortes = useCallback(async () => {
    if (!cortesUpdate || cortesUpdate.rows.length === 0) return
    setActualizando(true)
    setActualizadoMsg(null)
    try {
      const { ok, actualizados, error } = await actualizarStatusCortes(cortesUpdate.rows, userEmail)
      if (ok) {
        setActualizadoMsg(`✓ ${actualizados} ítems actualizados — refrescando...`)
        // Refrescar datos en pantalla para todos
        const items = await leerCargaActual()
        if (items.length > 0) {
          const recalc = items.map((it) => {
            const diasFinal = diasRestantes(it.auditoria_final)
            return { ...it, dias_fin_entrega: diasRestantes(it.fin_entrega), dias_auditoria_final: diasFinal, semaforo: calcularSemaforo(diasFinal) } satisfies ItemCruzado
          })
          setItemsDesdeNube(recalc)
        }
        setActualizadoMsg(`✓ ${actualizados} ítems de producción actualizados`)
      } else {
        setActualizadoMsg(`Error: ${error}`)
      }
    } finally {
      setActualizando(false)
    }
  }, [cortesUpdate, userEmail, setItemsDesdeNube])

  const handleResumenIA = useCallback(async () => {
    setIaLoading(true)
    setIaResumen(null)
    try {
      const vencidos = state.items.filter((i) => i.semaforo === 'rojo' && i.estado === 'Pendiente').slice(0, 15)
      const res = await fetch('/api/ia/resumen-semanal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpis, vencidos }),
      })
      const json = await res.json()
      setIaResumen(json.resultado ?? json.error)
    } finally {
      setIaLoading(false)
    }
  }, [state.items, kpis])

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Topbar */}
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-brand text-white grid place-items-center font-semibold text-sm">CM</div>
              <div className="leading-tight">
                <span className="font-semibold text-ink text-sm block">Auditorías Confección</span>
                <span className="text-[11px] text-ink-faint">CMT del Sur</span>
              </div>
            </div>
            <span className="hidden sm:block text-xs text-ink-muted bg-surface border border-line rounded px-2 py-0.5">
              {state.items.length} ítems
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <TabBtn icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
            <TabBtn icon={<Upload className="w-4 h-4" />} label="Cargar Excel" active={tab === 'carga'} onClick={() => setTab('carga')} />
            <TabBtn icon={<Users className="w-4 h-4" />} label="Por persona" active={tab === 'cumplimiento'} onClick={() => setTab('cumplimiento')} />
          </nav>
          <div className="flex items-center gap-2">
            {fechaActualizacion && (
              <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
                <span className="text-[10px] text-ink-faint uppercase tracking-wide">Status al</span>
                <span className="text-xs font-medium text-ink-muted">
                  {format(fechaActualizacion, "dd/MM/yy HH:mm", { locale: es })}
                </span>
              </div>
            )}
            {cargandoNube && <Spinner size="sm" />}
            <button
              onClick={handleRefrescarNube}
              disabled={cargandoNube}
              title="Refrescar datos de la nube"
              className="p-1.5 rounded-lg hover:bg-surface transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-4 h-4 text-ink-muted" />
            </button>
            <button
              onClick={() => setChatAbierto((v) => !v)}
              title="Asistente IA"
              className={`p-1.5 rounded-lg transition-colors ${chatAbierto ? 'bg-brand-600 text-white' : 'hover:bg-surface text-ink-muted'}`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── TAB: CARGA ── */}
        {tab === 'carga' && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-ink">Carga de archivos Excel</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DropZone<AuditoriaRow>
                label="Auditorías (hojas por semana)"
                parse={parseAuditorias}
                onParsed={handleParsedAuditorias}
                result={state.parseResults.auditorias}
              />
              <DropZone<PgoRow>
                label="PGO (hoja PGO)"
                parse={parsePgo}
                onParsed={(r) => setPgos(r)}
                result={state.parseResults.pgo}
              />
              <DropZone<CortesRow>
                label="Situación Órdenes (rptReporteSituacionOrdenesNew1)"
                parse={parseCortes}
                onParsed={(r) => setCortes(r)}
                result={state.parseResults.cortes}
              />
            </div>

            {state.diagnostico && (
              <>
                <PanelDiagnostico diagnostico={state.diagnostico} />

                <div className="flex flex-wrap gap-3 items-center">
                  {/* Publicar para todos */}
                  <button
                    onClick={handlePublicar}
                    disabled={publicando || state.items.length === 0}
                    className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {publicando ? <Spinner size="sm" /> : <Cloud className="w-4 h-4" />}
                    Publicar semana para todos
                  </button>

                  {/* Sincronizar seguimiento */}
                  <button
                    onClick={cargarYMerge}
                    disabled={loadingSeg}
                    className="flex items-center gap-2 border border-line text-ink-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface disabled:opacity-50 transition-colors"
                  >
                    {loadingSeg ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                    Sincronizar seguimiento
                  </button>
                </div>

                {publicadoMsg && (
                  <div className={`text-sm p-3 rounded-lg border ${publicadoMsg.startsWith('✓') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {publicadoMsg}
                  </div>
                )}
              </>
            )}

            {/* ── Actualización parcial mid-semana ── */}
            <div className="border-t border-line pt-5">
              <h3 className="text-sm font-semibold text-ink mb-1">Actualizar posición de producción</h3>
              <p className="text-xs text-ink-muted mb-3">
                Sube el archivo <span className="font-mono text-ink">rptReporteSituacionOrdenesNew1.xlsm</span> para actualizar el avance sin volver a cargar Auditorías ni PGO.
              </p>
              <div className="max-w-xs">
                <DropZone<CortesRow>
                  label="rptReporteSituacionOrdenesNew1.xlsm"
                  parse={parseCortes}
                  onParsed={setCortesUpdate}
                  result={cortesUpdate}
                />
              </div>
              {cortesUpdate && cortesUpdate.rows.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 items-center">
                  <button
                    onClick={handleActualizarCortes}
                    disabled={actualizando}
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {actualizando ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                    Actualizar Cortes
                  </button>
                  {actualizadoMsg && (
                    <span className={`text-sm ${actualizadoMsg.startsWith('✓') ? 'text-teal-700' : 'text-red-600'}`}>
                      {actualizadoMsg}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="space-y-5">
            <KPICards kpis={kpis} />

            {/* Resumen IA */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleResumenIA}
                disabled={iaLoading || state.items.length === 0}
                className="flex items-center gap-2 border border-brand-500 text-brand-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-50 disabled:opacity-40 transition-colors"
              >
                {iaLoading ? <Spinner size="sm" /> : <Wand2 className="w-4 h-4" />}
                Resumen ejecutivo IA
              </button>
              <button
                onClick={handleExportar}
                disabled={state.items.length === 0}
                className="flex items-center gap-2 border border-line text-ink-muted px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-surface disabled:opacity-40 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-ink-muted">Agrupar por</span>
                {(['semana', 'cliente', 'ninguno'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setAgruparPor(g)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${agruparPor === g ? 'bg-brand-600 text-white' : 'bg-white border border-line text-ink-muted hover:bg-surface'}`}
                  >
                    {g === 'ninguno' ? 'Ninguno' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {iaResumen && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-brand-600">Resumen ejecutivo (IA)</span>
                  <button onClick={() => setIaResumen(null)} className="text-xs text-ink-muted">✕</button>
                </div>
                <p className="text-sm text-ink">{iaResumen}</p>
              </div>
            )}

            <PanelFiltros
              items={state.items}
              filtros={filtros}
              onChange={setFiltros}
              llave={state.llaveCruce}
              onLlaveChange={setLlaveCruce}
            />

            <TablaPrincipal
              items={itemsFiltrados}
              onSelectItem={setSelectedItem}
              agruparPor={agruparPor}
            />
          </div>
        )}

        {/* ── TAB: CUMPLIMIENTO POR PERSONA ── */}
        {tab === 'cumplimiento' && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-ink">Cumplimiento por responsable</h2>
            <CumplimientoPorPersona personas={kpis.por_persona} />
          </div>
        )}
      </main>

      {/* Drawer */}
      {selectedItem && (
        <DrawerDetalle
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Chatbot */}
      <ChatBot items={state.items} isOpen={chatAbierto} onClose={() => setChatAbierto(false)} />

      {/* Botón flotante chat */}
      <button
        onClick={() => setChatAbierto((v) => !v)}
        title="Asistente IA"
        className="fixed bottom-4 right-4 w-12 h-12 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 transition-all hover:scale-105 z-50 grid place-items-center"
      >
        {chatAbierto
          ? <X className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />}
      </button>
    </div>
  )
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-ink-muted hover:text-ink hover:bg-surface'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
