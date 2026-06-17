import { supabase } from './supabase'
import { normalize, normalizePO } from './parsers/normalize'
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
    // Ruta y etapas de producción
    ruta:                it.ruta,
    en_estanteria:       it.en_estanteria,
    en_proceso:          it.en_proceso,
    confeccionadas:      it.confeccionadas,
    en_bordado:          it.en_bordado,
    bordadas:            it.bordadas,
    en_estampado:        it.en_estampado,
    estampadas:          it.estampadas,
    en_transfer:         it.en_transfer,
    transfer_terminadas: it.transfer_terminadas,
    en_lavanderia:       it.en_lavanderia,
    lavadas:             it.lavadas,
    ingresos_acabados_1ra: it.ingresos_acabados_1ra,
    ingresos_acabados_2da: it.ingresos_acabados_2da,
    en_acabados:         it.en_acabados,
    piezas_acabadas:     it.piezas_acabadas,
    total_requeridas:    it.total_requeridas,
    linea_costura:       it.linea_costura,
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

  const keys = carga.map((r: { item_key: string }) => r.item_key)

  const { data: segs, error: e2 } = await supabase
    .from('seguimiento')
    .select('*')
    .in('item_key', keys)

  if (e2) throw e2

  const segMap = new Map((segs ?? []).map((s: { item_key: string }) => [s.item_key, s]))

  return carga.map((row: Record<string, unknown>) => {
    const seg = segMap.get(row.item_key as string) as Record<string, unknown> | undefined
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
      // Ruta y etapas de producción
      ruta:                String(row.ruta                ?? ''),
      en_estanteria:       Number(row.en_estanteria       ?? 0),
      en_proceso:          Number(row.en_proceso          ?? 0),
      confeccionadas:      Number(row.confeccionadas      ?? 0),
      en_bordado:          Number(row.en_bordado          ?? 0),
      bordadas:            Number(row.bordadas            ?? 0),
      en_estampado:        Number(row.en_estampado        ?? 0),
      estampadas:          Number(row.estampadas          ?? 0),
      en_transfer:         Number(row.en_transfer         ?? 0),
      transfer_terminadas: Number(row.transfer_terminadas ?? 0),
      en_lavanderia:       Number(row.en_lavanderia       ?? 0),
      lavadas:             Number(row.lavadas             ?? 0),
      ingresos_acabados_1ra: Number(row.ingresos_acabados_1ra ?? 0),
      ingresos_acabados_2da: Number(row.ingresos_acabados_2da ?? 0),
      en_acabados:         Number(row.en_acabados         ?? 0),
      piezas_acabadas:     Number(row.piezas_acabadas     ?? 0),
      total_requeridas:    Number(row.total_requeridas    ?? 0),
      linea_costura:       String(row.linea_costura       ?? ''),
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
      compromisos:     ((seg?.compromisos ?? {}) as ItemCruzado['compromisos']),
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

  // Leer item_key + po + color de los ítems vigentes (mínimo de datos)
  const { data: vigentes, error: e1 } = await supabase
    .from('carga_actual')
    .select('item_key, po, color')
    .eq('vigente', true)

  if (e1) return { ok: false, actualizados: 0, error: e1.message }
  if (!vigentes || vigentes.length === 0)
    return { ok: false, actualizados: 0, error: 'No hay ítems publicados vigentes' }

  // Mapa po|color → item_key[] (un mismo PO+color puede estar en varias semanas)
  const keyMap = new Map<string, string[]>()
  for (const v of vigentes as { item_key: string; po: string; color: string }[]) {
    const k = `${normalizePO(v.po)}|${normalize(v.color)}`
    const arr = keyMap.get(k) ?? []
    arr.push(v.item_key)
    keyMap.set(k, arr)
  }

  const ahora = new Date().toISOString()
  const updateRows: Record<string, unknown>[] = []

  for (const cr of cortesRows) {
    const k = `${normalizePO(cr.po)}|${normalize(cr.color)}`
    const itemKeys = keyMap.get(k)
    if (!itemKeys) continue

    for (const item_key of itemKeys) {
      updateRows.push({
        item_key,
        ruta:                  cr.ruta,
        en_estanteria:         cr.en_estanteria,
        en_proceso:            cr.en_proceso,
        confeccionadas:        cr.confeccionadas,
        en_bordado:            cr.en_bordado,
        bordadas:              cr.bordadas,
        en_estampado:          cr.en_estampado,
        estampadas:            cr.estampadas,
        en_transfer:           cr.en_transfer,
        transfer_terminadas:   cr.transfer_terminadas,
        en_lavanderia:         cr.en_lavanderia,
        lavadas:               cr.lavadas,
        ingresos_acabados_1ra: cr.ingresos_acabados_1ra,
        ingresos_acabados_2da: cr.ingresos_acabados_2da,
        en_acabados:           cr.en_acabados,
        piezas_acabadas:       cr.piezas_acabadas,
        total_requeridas:      cr.total_requeridas,
        linea_costura:         cr.linea_costura,
        cargado_por:           cargadoPor,
        cargado_at:            ahora,
      })
    }
  }

  if (updateRows.length === 0)
    return { ok: false, actualizados: 0, error: 'Ninguna fila del Cortes coincide con ítems publicados' }

  // Upsert: onConflict item_key → solo actualiza las columnas presentes en el payload
  const { error: e2 } = await supabase
    .from('carga_actual')
    .upsert(updateRows, { onConflict: 'item_key' })

  if (e2) return { ok: false, actualizados: 0, error: e2.message }

  return { ok: true, actualizados: updateRows.length }
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
