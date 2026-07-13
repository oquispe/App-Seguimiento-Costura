import { supabase } from './supabase'
import { normalize, normalizePO, makeBaseKey, stripColorCode } from './parsers/normalize'
import type { ItemCruzado, CortesRow } from '../types'

/**
 * Guarda el dataset cruzado en "carga_actual" (Supabase).
 * - Upsert por item_key (mantiene datos frescos de la semana).
 * - Marca vigente=false en item_keys que ya no aparezcan (soft-delete).
 * - NUNCA toca la tabla "seguimiento".
 */
export async function publicarCargaActual(
  items: ItemCruzado[],
  cargadoPor: string
): Promise<{ ok: boolean; error?: string }> {
  if (items.length === 0) return { ok: false, error: 'Sin ítems para publicar' }

  const ahora = new Date().toISOString()

  // 1. Marcar todos los ítems actuales como no vigentes (reset global).
  //    El upsert siguiente los reactiva; los que no aparezcan quedan vigente=false.
  //    Evita enviar un NOT IN con cientos de item_keys que supera el límite de URL de PostgREST.
  const { error: e1 } = await supabase
    .from('carga_actual')
    .update({ vigente: false })
    .eq('vigente', true)

  if (e1) return { ok: false, error: e1.message }

  // 2. Upsert de los ítems actuales con todas las etapas de producción
  const rows = items.map((it, idx) => ({
    item_key:    it.item_key,
    base_key:    it.base_key,
    sort_order:  idx,
    semana:      it.semana,
    cliente:     it.cliente,
    estilo:      it.estilo,
    po:          it.po,
    color:       it.color,
    cant_prog:   it.cant_prog,
    externa:     it.externa,
    fin_entrega:    it.fin_entrega?.toISOString().split('T')[0]    ?? null,
    auditoria:      it.auditoria?.toISOString().split('T')[0]      ?? null,
    auditoria_final: it.auditoria_final?.toISOString().split('T')[0] ?? null,
    // Posición en producción
    op:                  it.op,
    ruta:                it.ruta,
    en_corte:            it.en_corte,
    en_bordado:          it.en_bordado,
    en_costura:          it.en_costura,
    en_estampado:        it.en_estampado,
    en_estampado_ext:    it.en_estampado_ext,
    en_transfer:         it.en_transfer,
    en_lavanderia:       it.en_lavanderia,
    en_costura_lineas:   it.en_costura_lineas,
    en_acabado:          it.en_acabado,
    apt:                 it.apt,
    exportado:           it.exportado,
    porc_exp:            it.porc_exp,
    total_requeridas:    it.total_requeridas,
    ops:                 it.ops ?? [],
    vigente:     true,
    cargado_por: cargadoPor,
    cargado_at:  ahora,
  }))

  // Deduplicar por item_key antes del upsert para evitar
  // "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const rowsMap = new Map<string, (typeof rows)[0]>()
  for (const row of rows) rowsMap.set(row.item_key, row)
  const rowsUnicos = Array.from(rowsMap.values())

  const { error: e2 } = await supabase
    .from('carga_actual')
    .upsert(rowsUnicos, { onConflict: 'item_key' })

  if (e2) return { ok: false, error: e2.message }

  return { ok: true }
}

/**
 * Lee carga_actual (vigente=true) y hace LEFT JOIN con seguimiento.
 * Devuelve ItemCruzado[] con el seguimiento persistido.
 */
export async function leerCargaActual(): Promise<ItemCruzado[]> {
  const { data: carga, error: e1 } = await supabase
    .from('carga_actual')
    .select('*')
    .eq('vigente', true)
    .order('sort_order', { ascending: true })

  if (e1) throw e1
  if (!carga || carga.length === 0) return []

  const baseKeys = carga.map((r: { base_key: string }) => r.base_key)

  const { data: segs, error: e2 } = await supabase
    .from('seguimiento')
    .select('*')
    .in('base_key', baseKeys)

  if (e2) throw e2

  const segMap = new Map((segs ?? []).map((s: { base_key: string }) => [s.base_key, s]))

  return carga.map((row: Record<string, unknown>) => {
    const seg = segMap.get(row.base_key as string) as Record<string, unknown> | undefined
    const parseDate = (v: unknown): Date | null => {
      if (!v) return null
      const s = String(v)
      // YYYY-MM-DD desde Supabase: new Date("2024-06-15") = UTC midnight
      // → en UTC-5 se convierte al día anterior. Usar T12:00:00 para mediodía local.
      const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s)
      return isNaN(d.getTime()) ? null : d
    }

    return {
      item_key:    row.item_key,
      base_key:    row.base_key,
      semana:      row.semana,
      cliente:     row.cliente,
      estilo:      row.estilo,
      po:          row.po,
      color:       row.color,
      cant_prog:   row.cant_prog,
      externa:     row.externa,
      fin_entrega:     parseDate(row.fin_entrega),
      auditoria:       parseDate(row.auditoria),
      auditoria_final: parseDate(row.auditoria_final),
      // Posición en producción
      op:                  String(row.op                  ?? ''),
      ruta:                String(row.ruta                ?? ''),
      en_corte:            Number(row.en_corte            ?? 0),
      en_bordado:          Number(row.en_bordado          ?? 0),
      en_costura:          Number(row.en_costura          ?? 0),
      en_estampado:        Number(row.en_estampado        ?? 0),
      en_estampado_ext:    Number(row.en_estampado_ext    ?? 0),
      en_transfer:         Number(row.en_transfer         ?? 0),
      en_lavanderia:       Number(row.en_lavanderia       ?? 0),
      en_costura_lineas:   Number(row.en_costura_lineas   ?? 0),
      en_acabado:          Number(row.en_acabado          ?? 0),
      apt:                 Number(row.apt                 ?? 0),
      exportado:           Number(row.exportado           ?? 0),
      porc_exp:            Number(row.porc_exp            ?? 0),
      total_requeridas:    Number(row.total_requeridas    ?? 0),
      ops:                 (row.ops ?? []) as ItemCruzado['ops'],
      // Semáforo se recalcula en cliente
      dias_fin_entrega:    null,
      dias_auditoria_final: null,
      semaforo:            'sin-fecha',
      // Seguimiento (de Supabase, conservado)
      estado:          (seg?.estado         ?? 'Pendiente') as ItemCruzado['estado'],
      resultado:       (seg?.resultado      ?? null) as string | null,
      fecha_solicitada: (seg?.fecha_solicitada ?? null) as string | null,
      fecha_auditoria: (seg?.fecha_auditoria  ?? null) as string | null,
      solicitado_por:  (seg?.solicitado_por   ?? null) as string | null,
      responsable:     (seg?.responsable      ?? null) as string | null,
      compromisos:                ((seg?.compromisos ?? {}) as ItemCruzado['compromisos']),
      auditoria_final_override:  (seg?.auditoria_final_override ?? null) as string | null,
    } as ItemCruzado
  })
}

/**
 * Actualización parcial mid-semana: solo reemplaza los campos de producción
 * (posición en ruta, etapas, ingresos acabados) sin tocar fechas, semana,
 * cliente, PO ni sort_order. Útil cuando el Status Cortes se actualiza a
 * diario pero Auditorías y PGO no cambian.
 */
export async function actualizarStatusCortes(
  cortesRows: CortesRow[],
  cargadoPor: string
): Promise<{ ok: boolean; actualizados: number; error?: string }> {
  if (cortesRows.length === 0) return { ok: false, actualizados: 0, error: 'Sin filas de cortes' }

  // Leer item_key + po + estilo + color de los ítems vigentes (mínimo de datos)
  const { data: vigentes, error: e1 } = await supabase
    .from('carga_actual')
    .select('item_key, po, estilo, color')
    .eq('vigente', true)

  if (e1) return { ok: false, actualizados: 0, error: e1.message }
  if (!vigentes || vigentes.length === 0)
    return { ok: false, actualizados: 0, error: 'No hay ítems publicados vigentes' }

  // Un mismo PO+color puede repartirse entre varios estilos distintos, cada
  // uno en una etapa de producción diferente (ej. PO 1691497 con 4 estilos en
  // "NAVY"). Además, el color guardado en carga_actual viene de Auditorías
  // (ej. "NAVY - NAVY") mientras que el del Status trae el formato oficial
  // (ej. "NAVY") — sin el mismo matching fuzzy que usa buscarCorte() en
  // cruzar.ts, esa diferencia de formato hace que el ítem nunca calce y se
  // quede con datos viejos para siempre en cada "Actualizar Cortes".
  type Vigente = { item_key: string; po: string; estilo: string | null; color: string }
  const porPO = new Map<string, Vigente[]>()
  for (const v of vigentes as Vigente[]) {
    const kPO = normalizePO(v.po)
    const arr = porPO.get(kPO) ?? []
    arr.push(v)
    porPO.set(kPO, arr)
  }

  // Misma prioridad que buscarCorte(): exacto → color sin código (fuzzy) →
  // único ítem vigente bajo ese PO+estilo (sin ambigüedad).
  function buscarVigentes(cr: CortesRow): string[] | undefined {
    const candidatosPO = porPO.get(normalizePO(cr.po))
    if (!candidatosPO || candidatosPO.length === 0) return undefined

    const crEstiloNorm = normalize(cr.estilo)
    const hayVariosEstilos = new Set(candidatosPO.map(v => normalize(v.estilo ?? ''))).size > 1
    const porEstilo = hayVariosEstilos && crEstiloNorm
      ? candidatosPO.filter(v => normalize(v.estilo ?? '') === crEstiloNorm)
      : []
    const candidatos = porEstilo.length > 0 ? porEstilo : candidatosPO

    const crColorNorm  = normalize(cr.color)
    const crColorStrip = stripColorCode(cr.color)

    const exacto = candidatos.filter(v => normalize(v.color) === crColorNorm)
    if (exacto.length > 0) return exacto.map(v => v.item_key)

    const fuzzy = candidatos.filter(v => stripColorCode(v.color) === crColorStrip)
    if (fuzzy.length > 0) return fuzzy.map(v => v.item_key)

    if (candidatos.length === 1) return [candidatos[0].item_key]

    return undefined
  }

  const ahora = new Date().toISOString()
  const updateRows: Record<string, unknown>[] = []

  for (const cr of cortesRows) {
    const itemKeys = buscarVigentes(cr)
    if (!itemKeys) continue

    for (const item_key of itemKeys) {
      updateRows.push({
        item_key,
        op:                  cr.op,
        ruta:                cr.ruta,
        en_corte:            cr.en_corte,
        en_bordado:          cr.en_bordado,
        en_costura:          cr.en_costura,
        en_estampado:        cr.en_estampado,
        en_estampado_ext:    cr.en_estampado_ext,
        en_transfer:         cr.en_transfer,
        en_lavanderia:       cr.en_lavanderia,
        en_costura_lineas:   cr.en_costura_lineas,
        en_acabado:          cr.en_acabado,
        apt:                 cr.apt,
        exportado:           cr.exportado,
        porc_exp:            cr.porc_exp,
        total_requeridas:    cr.total_requeridas,
        ops:                 cr.ops ?? [],
        cargado_por:         cargadoPor,
        cargado_at:          ahora,
      })
    }
  }

  if (updateRows.length === 0)
    return { ok: false, actualizados: 0, error: 'Ninguna fila del Cortes coincide con ítems publicados' }

  // Deduplicar por item_key antes del upsert para evitar
  // "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // (ocurre cuando dos filas del Cortes resuelven al mismo item_key, ej.
  // por un match ambiguo de color o filas duplicadas en el reporte).
  const updateRowsMap = new Map<string, (typeof updateRows)[0]>()
  for (const row of updateRows) updateRowsMap.set(row.item_key as string, row)
  const updateRowsUnicos = Array.from(updateRowsMap.values())

  // Upsert: onConflict item_key → solo actualiza las columnas presentes en el payload
  const { error: e2 } = await supabase
    .from('carga_actual')
    .upsert(updateRowsUnicos, { onConflict: 'item_key' })

  if (e2) return { ok: false, actualizados: 0, error: e2.message }

  return { ok: true, actualizados: updateRowsUnicos.length }
}

/** Devuelve la fecha de la última publicación/actualización vigente */
export async function leerUltimaActualizacion(): Promise<Date | null> {
  const { data } = await supabase
    .from('carga_actual')
    .select('cargado_at')
    .eq('vigente', true)
    .order('cargado_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.cargado_at) return null
  return new Date(data.cargado_at as string)
}

/** Guarda snapshot opcional de la semana en snapshots_semana */
export async function guardarSnapshot(
  semana: string,
  items: ItemCruzado[],
  cargadoPor: string
): Promise<void> {
  await supabase.from('snapshots_semana').upsert({
    semana,
    snapshot: items,
    cargado_por: cargadoPor,
    cargado_at: new Date().toISOString(),
  }, { onConflict: 'semana' })
}
