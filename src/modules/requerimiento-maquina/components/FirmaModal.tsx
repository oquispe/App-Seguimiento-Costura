import { useCallback, useState } from 'react'
import { X, Search, CheckCircle2 } from 'lucide-react'
import { buscarEmpleado } from '../lib/rmReports'
import { clasificarRolOperacion, clasificarRolFinal } from '../lib/rolFirma'
import { BarcodeScanner } from './BarcodeScanner'
import { Spinner } from '../../../components/ui/Spinner'
import { getErrorMessage } from '../../../lib/errorUtils'
import type { EmpleadoRow, RolFirmaOperacion, RolFirmaFinal, MetodoFirma } from '../types'

interface Props {
  titulo: string
  /** Si se da, exige que el rol clasificado coincida (ej. el botón de "firmar operario"). */
  rolEsperado?: RolFirmaOperacion | RolFirmaFinal
  modo: 'operacion' | 'final'
  onClose: () => void
  onConfirm: (empleado: EmpleadoRow, rol: RolFirmaOperacion | RolFirmaFinal, metodo: MetodoFirma) => Promise<void>
}

export function FirmaModal({ titulo, rolEsperado, modo, onClose, onConfirm }: Props) {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [encontrado, setEncontrado] = useState<EmpleadoRow | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [metodo, setMetodo] = useState<MetodoFirma>('manual')

  const buscar = useCallback(async (valor: string) => {
    const v = valor.trim()
    if (!v) return
    setBuscando(true)
    setError(null)
    setEncontrado(null)
    try {
      const empleado = await buscarEmpleado(v)
      if (!empleado) {
        setError(`No se encontró ningún empleado con DNI/código "${v}"`)
        return
      }
      const rol = modo === 'operacion' ? clasificarRolOperacion(empleado.ocupacion) : clasificarRolFinal(empleado.ocupacion)
      if (!rol) {
        setError(`La ocupación "${empleado.ocupacion}" de ${empleado.nombre_completo} no corresponde a ningún rol de firma`)
        return
      }
      if (rolEsperado && rol !== rolEsperado) {
        setError(`${empleado.nombre_completo} tiene rol "${rol}", se esperaba "${rolEsperado}"`)
        return
      }
      setEncontrado(empleado)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBuscando(false)
    }
  }, [modo, rolEsperado])

  const confirmar = useCallback(async () => {
    if (!encontrado) return
    const rol = (modo === 'operacion' ? clasificarRolOperacion(encontrado.ocupacion) : clasificarRolFinal(encontrado.ocupacion))!
    setConfirmando(true)
    try {
      await onConfirm(encontrado, rol, metodo)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
      setConfirmando(false)
    }
  }, [encontrado, modo, onConfirm, onClose, metodo])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-ink-faint hover:bg-surface hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <BarcodeScanner onDetected={(v) => { setMetodo('camara'); setQuery(v); buscar(v) }} />

          <div className="flex gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setMetodo('manual'); buscar(query) } }}
              placeholder="DNI o código"
              className="flex-1 text-sm border border-line rounded-lg px-3 py-1.5"
            />
            <button
              onClick={() => { setMetodo('manual'); buscar(query) }}
              disabled={buscando}
              className="flex items-center gap-1 text-xs font-medium text-white bg-brand-600 rounded-lg px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
            >
              {buscando ? <Spinner size="sm" /> : <Search className="w-3.5 h-3.5" />}
              Buscar
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {encontrado && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{encontrado.nombre_completo}</p>
                <p className="text-xs text-ink-muted truncate">{encontrado.ocupacion} · DNI {encontrado.dni} · {metodo === 'camara' ? 'escaneado con cámara' : 'ingresado manualmente'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-line">
          <button onClick={onClose} className="text-xs font-medium text-ink-muted px-3 py-1.5 rounded-lg hover:bg-surface">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!encontrado || confirmando}
            className="text-xs font-medium text-white bg-brand-600 rounded-lg px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
          >
            {confirmando ? 'Firmando…' : 'Confirmar firma'}
          </button>
        </div>
      </div>
    </div>
  )
}
