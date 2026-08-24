import { useState, useCallback } from 'react'
import type {
  AuditoriaRow,
  PgoRow,
  CortesRow,
  LineaRow,
  ItemCruzado,
  DiagnosticoCruce,
  LlaveCruce,
  ParseResult,
} from '../types'
import { cruzarDatos } from '../lib/parsers/cruzar'

export interface AppState {
  auditorias: AuditoriaRow[]
  pgos: PgoRow[]
  cortes: CortesRow[]
  lineas: LineaRow[]
  items: ItemCruzado[]
  diagnostico: DiagnosticoCruce | null
  llaveCruce: LlaveCruce
  parseResults: {
    auditorias: ParseResult<AuditoriaRow> | null
    pgo: ParseResult<PgoRow> | null
    cortes: ParseResult<CortesRow> | null
    lineas: ParseResult<LineaRow> | null
  }
}

const EMPTY_STATE: AppState = {
  auditorias: [],
  pgos: [],
  cortes: [],
  lineas: [],
  items: [],
  diagnostico: null,
  llaveCruce: 'PO',
  parseResults: { auditorias: null, pgo: null, cortes: null, lineas: null },
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)

  const setAuditorias = useCallback(
    (result: ParseResult<AuditoriaRow>) => {
      setState((prev) => {
        const next = { ...prev, auditorias: result.rows, parseResults: { ...prev.parseResults, auditorias: result } }
        const { items, diagnostico } = cruzarDatos(next.auditorias, next.pgos, next.cortes, next.llaveCruce, next.lineas)
        return { ...next, items, diagnostico }
      })
    },
    []
  )

  const setPgos = useCallback(
    (result: ParseResult<PgoRow>) => {
      setState((prev) => {
        const next = { ...prev, pgos: result.rows, parseResults: { ...prev.parseResults, pgo: result } }
        const { items, diagnostico } = cruzarDatos(next.auditorias, next.pgos, next.cortes, next.llaveCruce, next.lineas)
        return { ...next, items, diagnostico }
      })
    },
    []
  )

  const setCortes = useCallback(
    (result: ParseResult<CortesRow>) => {
      setState((prev) => {
        const next = { ...prev, cortes: result.rows, parseResults: { ...prev.parseResults, cortes: result } }
        const { items, diagnostico } = cruzarDatos(next.auditorias, next.pgos, next.cortes, next.llaveCruce, next.lineas)
        return { ...next, items, diagnostico }
      })
    },
    []
  )

  const setLineas = useCallback(
    (result: ParseResult<LineaRow>) => {
      setState((prev) => {
        const next = { ...prev, lineas: result.rows, parseResults: { ...prev.parseResults, lineas: result } }
        const { items, diagnostico } = cruzarDatos(next.auditorias, next.pgos, next.cortes, next.llaveCruce, next.lineas)
        return { ...next, items, diagnostico }
      })
    },
    []
  )

  const setLlaveCruce = useCallback(
    (llave: LlaveCruce) => {
      setState((prev) => {
        const { items, diagnostico } = cruzarDatos(prev.auditorias, prev.pgos, prev.cortes, llave, prev.lineas)
        return { ...prev, llaveCruce: llave, items, diagnostico }
      })
    },
    []
  )

  const mergeSegimiento = useCallback(
    (seguimientos: Array<{ item_key: string } & Partial<ItemCruzado>>) => {
      const map = new Map(seguimientos.map((s) => [s.item_key, s]))
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => {
          const seg = map.get(it.item_key)
          return seg ? { ...it, ...seg } : it
        }),
      }))
    },
    []
  )

  /** Reemplaza los ítems con datos provenientes directamente de la nube (carga_actual). */
  const setItemsDesdeNube = useCallback((items: ItemCruzado[]) => {
    setState((prev) => ({ ...prev, items }))
  }, [])

  return { state, setAuditorias, setPgos, setCortes, setLineas, setLlaveCruce, mergeSegimiento, setItemsDesdeNube }
}
