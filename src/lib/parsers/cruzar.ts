import { normalizePO, normalize, makeItemKey, makeBaseKey, stripColorCode } from './normalize'
import { diasRestantes, calcularSemaforo } from './dateUtils'
import type {
  AuditoriaRow,
  PgoRow,
  CortesRow,
  ItemCruzado,
  DiagnosticoCruce,
  LlaveCruce,
  LineaRow,
  LineaDetalle,
} from '../../types'

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/**
 * Algunos reportes de origen exportan el mismo PO de forma inconsistente
 * entre filas: unas veces solo el PO ("1687930") y otras con un número
 * secundario pegado después de un espacio ("1687930 56151"), aparentemente
 * un número de lote/release interno. Usamos el primer token como bucket de
 * respaldo para el cruce cuando el otro reporte no trae ese sufijo — así no
 * se pierden filas reales solo porque el formato del PO varió.
 */
export function primerTokenPO(po: string): string {
  return po.split(' ')[0]
}

/**
 * Filtra candidatos de un mismo PO por estilo (si hay ambigüedad) y color,
 * con la misma prioridad sin importar la dirección del cruce (Auditorías→
 * Cortes en buscarCorte, o Cortes→ítems publicados en la actualización
 * diaria): exacto → sin código → único candidato → truncado → prefijo
 * "ABREVIADO - NOMBRE COMPLETO". Devuelve todos los candidatos que
 * matchean en el primer tier con resultado (puede haber más de uno si el
 * mismo color se repite en varias OPs).
 */
export function filtrarPorEstiloColor<T extends { estilo?: string | null; color: string }>(
  candidatosPO: T[],
  targetEstilo: string,
  targetColor: string
): T[] {
  const targetEstiloNorm = normalize(targetEstilo)
  const hayVariosEstilos = new Set(candidatosPO.map(c => normalize(c.estilo ?? ''))).size > 1
  const porEstilo = hayVariosEstilos && targetEstiloNorm
    ? candidatosPO.filter(c => normalize(c.estilo ?? '') === targetEstiloNorm)
    : []
  const candidatos = porEstilo.length > 0 ? porEstilo : candidatosPO

  const targetColorNorm  = normalize(targetColor)
  const targetColorStrip = stripColorCode(targetColor)

  const exacto = candidatos.filter(c => normalize(c.color) === targetColorNorm)
  if (exacto.length > 0) return exacto

  const fuzzy = candidatos.filter(c => stripColorCode(c.color) === targetColorStrip)
  if (fuzzy.length > 0) return fuzzy

  if (candidatos.length === 1) return candidatos

  // Bidireccional: cualquiera de los dos lados (candidato o target) puede
  // ser el que llegó truncado, según el reporte de origen de cada uno.
  const truncado = candidatos.filter(c => {
    const cNorm = normalize(c.color)
    return (cNorm.length >= 5 && (
      targetColorStrip.startsWith(cNorm) || targetColorNorm.startsWith(cNorm)
    )) || (targetColorNorm.length >= 5 && (
      cNorm.startsWith(targetColorStrip) || cNorm.startsWith(targetColorNorm)
    ))
  })
  if (truncado.length > 0) return truncado

  const partes = targetColorNorm.split(/\s*[-–]\s*/)
  for (let len = 1; len < partes.length; len++) {
    const prefijo = partes.slice(0, len).join(' - ')
    const encontrado = candidatos.filter(c => normalize(c.color) === prefijo)
    if (encontrado.length > 0) return encontrado
  }

  return []
}

/**
 * Agrupa filas de líneas (status.xlsm) por línea normalizada, sumando
 * cantidades — una misma OP puede tener varias partidas en la misma línea.
 */
export function agruparLineas(rows: LineaRow[]): LineaDetalle[] {
  const acum = new Map<string, LineaDetalle>()
  for (const r of rows) {
    const key = normalize(r.linea)
    const existing = acum.get(key)
    if (existing) {
      existing.en_estanteria += toNum(r.en_estanteria)
      existing.en_proceso += toNum(r.en_proceso)
      existing.cantidad += toNum(r.en_estanteria) + toNum(r.en_proceso)
    } else {
      acum.set(key, {
        linea: r.linea,
        en_estanteria: toNum(r.en_estanteria),
        en_proceso: toNum(r.en_proceso),
        cantidad: toNum(r.en_estanteria) + toNum(r.en_proceso),
      })
    }
  }
  return Array.from(acum.values())
}

/**
 * Busca las líneas de costura de un ítem: primero por PO+OP exacto (preciso,
 * ambos reportes traen OP), y si no hay match cae a PO+Estilo+Color fuzzy
 * (mismo criterio que buscarCorte) para tolerar OPs vacías o desalineadas.
 */
export function buscarLineas(
  po: string,
  op: string,
  estilo: string,
  color: string,
  lineasPorPOOp: Map<string, LineaRow[]>,
  lineasPorPO: Map<string, LineaRow[]>
): LineaRow[] {
  const crucePO = normalizePO(po)
  if (op) {
    const exacto = lineasPorPOOp.get(`${crucePO}|${op.trim()}`)
      ?? lineasPorPOOp.get(`${primerTokenPO(crucePO)}|${op.trim()}`)
    if (exacto && exacto.length > 0) return exacto
  }

  const todos = lineasPorPO.get(crucePO) ?? lineasPorPO.get(primerTokenPO(crucePO))
  if (!todos || todos.length === 0) return []

  const estiloNorm = normalize(estilo)
  const hayVariosEstilos = new Set(todos.map(l => normalize(l.estilo))).size > 1
  const porEstilo = hayVariosEstilos && estiloNorm
    ? todos.filter(l => normalize(l.estilo) === estiloNorm)
    : []
  const candidatos = porEstilo.length > 0 ? porEstilo : todos

  const colorNorm  = normalize(color)
  const colorStrip = stripColorCode(color)

  const exacto = candidatos.filter(l => normalize(l.color) === colorNorm)
  if (exacto.length > 0) return exacto

  const fuzzy = candidatos.filter(l => stripColorCode(l.color) === colorStrip)
  if (fuzzy.length > 0) return fuzzy

  const soloUnColor = new Set(candidatos.map(l => normalize(l.color))).size === 1
  if (soloUnColor) return candidatos

  return []
}

/**
 * Busca la mejor fila de Cortes para un PO+Estilo+Color de Auditorías.
 * Fuente de verdad: el Status y el PGO tienen el color correcto;
 * el Excel de Auditorías puede tener variaciones o errores de escritura.
 *
 * Un mismo PO puede repartirse entre muchos estilos distintos que además
 * comparten color (ej. PO 1691497 tiene 4 estilos distintos en "NAVY", cada
 * uno en una etapa de producción diferente). Por eso primero se acota por
 * estilo y recién ahí se busca el color — si no, se puede mezclar el avance
 * de un estilo con el de otro sin relación.
 *
 * Prioridad:
 * 1. PO + Estilo + Color exacto (normalizado)
 * 2. PO + Estilo + Color sin código numérico ("0421 - Breaker Blue" ≈ "Breaker Blue")
 * 3. PO + Estilo con un único color en Cortes (no hay ambigüedad)
 * 4. null → produccion_cerrada
 */
function buscarCorte(
  crucePO: string,
  auditColor: string,
  auditEstilo: string,
  cortesPorPO: Map<string, CortesRow[]>
): CortesRow | null {
  const todos = cortesPorPO.get(crucePO) ?? cortesPorPO.get(primerTokenPO(crucePO))
  if (!todos || todos.length === 0) return null

  const match = filtrarPorEstiloColor(todos, auditEstilo, auditColor)
  return match[0] ?? null
}

/** Índice de líneas (status.xlsm): PO+OP exacto, y PO (para fallback fuzzy). */
export function indexarLineas(lineas: LineaRow[]): {
  lineasPorPOOp: Map<string, LineaRow[]>
  lineasPorPO: Map<string, LineaRow[]>
} {
  const lineasPorPOOp = new Map<string, LineaRow[]>()
  const lineasPorPO = new Map<string, LineaRow[]>()
  for (const l of lineas) {
    const kPO = normalizePO(l.po)
    const kPOOp = `${kPO}|${l.op.trim()}`
    const arrOp = lineasPorPOOp.get(kPOOp) ?? []
    arrOp.push(l)
    lineasPorPOOp.set(kPOOp, arrOp)
    const arrPO = lineasPorPO.get(kPO) ?? []
    arrPO.push(l)
    lineasPorPO.set(kPO, arrPO)

    const prefijo = primerTokenPO(kPO)
    if (prefijo !== kPO) {
      const kPOOpPrefijo = `${prefijo}|${l.op.trim()}`
      const arrOpPrefijo = lineasPorPOOp.get(kPOOpPrefijo) ?? []
      arrOpPrefijo.push(l)
      lineasPorPOOp.set(kPOOpPrefijo, arrOpPrefijo)
      const arrPOPrefijo = lineasPorPO.get(prefijo) ?? []
      arrPOPrefijo.push(l)
      lineasPorPO.set(prefijo, arrPOPrefijo)
    }
  }
  return { lineasPorPOOp, lineasPorPO }
}

export function cruzarDatos(
  auditorias: AuditoriaRow[],
  pgos: PgoRow[],
  cortes: CortesRow[],
  llave: LlaveCruce = 'PO',
  lineas: LineaRow[] = []
): { items: ItemCruzado[]; diagnostico: DiagnosticoCruce } {
  const { lineasPorPOOp, lineasPorPO } = indexarLineas(lineas)

  // Índice PGO
  const pgoIdx = new Map<string, PgoRow>()
  for (const p of pgos) {
    const k = llave === 'PO+COLOR'
      ? `${normalizePO(p.po)}|${normalize(p.color)}`
      : normalizePO(p.po)
    if (!pgoIdx.has(k)) pgoIdx.set(k, p)
  }

  // Índice Cortes: PO → lista de CortesRow (todos los colores de ese PO)
  // Fuente de verdad para el color: el Status tiene el nombre oficial
  const cortesPorPO = new Map<string, CortesRow[]>()
  for (const c of cortes) {
    const kPO = normalizePO(c.po)
    const arr = cortesPorPO.get(kPO) ?? []
    arr.push(c)
    cortesPorPO.set(kPO, arr)

    const prefijo = primerTokenPO(kPO)
    if (prefijo !== kPO) {
      const arrPrefijo = cortesPorPO.get(prefijo) ?? []
      arrPrefijo.push(c)
      cortesPorPO.set(prefijo, arrPrefijo)
    }
  }

  const items: ItemCruzado[] = []
  const sinPgo: Set<string> = new Set()
  const sinMatch: { po: string; color: string }[] = []
  let conPgo = 0
  let conCortes = 0

  for (const aud of auditorias) {
    const crucePO    = normalizePO(aud.po)
    const cruceColor = normalize(aud.color)

    // Cruce PGO
    const pgoKey = llave === 'PO+COLOR'
      ? `${crucePO}|${cruceColor}`
      : crucePO
    const pgo = pgoIdx.get(pgoKey) ?? null

    // Cruce Cortes: búsqueda robusta (exacto → fuzzy → único color del PO+estilo)
    const corte = buscarCorte(crucePO, aud.color, aud.estilo, cortesPorPO)

    if (pgo) conPgo++
    else sinPgo.add(crucePO)

    // Si no aparece en el reporte → sin datos de producción
    const produccionCerrada = corte === null
    if (corte) conCortes++
    else sinMatch.push({ po: aud.po, color: aud.color })

    const totalRequeridas = corte?.total_requeridas ?? (aud.cant_prog ?? 0)
    const aptFallback     = 0

    const lineasMatch = buscarLineas(
      crucePO, corte?.op ?? '', aud.estilo, aud.color, lineasPorPOOp, lineasPorPO
    )
    const lineasDetalle = agruparLineas(lineasMatch)

    const diasFinal  = diasRestantes(pgo?.auditoria_final ?? null)
    const item_key   = makeItemKey(aud.po, aud.estilo, aud.color, aud.semana)
    const base_key   = makeBaseKey(aud.po, aud.estilo, aud.color)

    items.push({
      item_key,
      base_key,
      semana:      aud.semana,
      cliente:     aud.cliente,
      estilo:      aud.estilo,
      po:          aud.po,
      color:       aud.color,
      cant_prog:   aud.cant_prog,
      externa:     aud.externa,
      // PGO
      fin_entrega:     pgo?.fin_entrega      ?? null,
      auditoria:       pgo?.auditoria        ?? null,
      auditoria_final: pgo?.auditoria_final  ?? null,
      // Posición en producción (de rptReporteSituacionOrdenes)
      op:                  corte?.op                  ?? '',
      ruta:                corte?.ruta                ?? '',
      en_corte:            corte?.en_corte            ?? 0,
      en_bordado:          corte?.en_bordado          ?? 0,
      en_costura:          corte?.en_costura          ?? 0,
      en_estampado:        corte?.en_estampado        ?? 0,
      en_estampado_ext:    corte?.en_estampado_ext    ?? 0,
      en_transfer:         corte?.en_transfer         ?? 0,
      en_lavanderia:       corte?.en_lavanderia       ?? 0,
      en_costura_lineas:   corte?.en_costura_lineas   ?? 0,
      en_acabado:          corte?.en_acabado          ?? 0,
      apt:                 corte?.apt                 ?? aptFallback,
      exportado:           corte?.exportado           ?? 0,
      porc_exp:            corte?.porc_exp            ?? 0,
      total_requeridas:    totalRequeridas,
      produccion_cerrada:  produccionCerrada,
      ops:                 corte?.ops ?? [],
      lineas:              lineasDetalle,
      // Semáforo
      dias_fin_entrega:     diasRestantes(pgo?.fin_entrega ?? null),
      dias_auditoria_final: diasFinal,
      semaforo:             calcularSemaforo(diasFinal),
      // Defaults de seguimiento (se sobreescribirán con datos de Supabase)
      estado:           'Pendiente',
      resultado:        null,
      fecha_solicitada: null,
      fecha_auditoria:  null,
      solicitado_por:   null,
      responsable:      null,
      compromisos:                {},
      compromisos_linea:          {},
      auditoria_final_override:  null,
    })
  }

  // Deduplicar por item_key
  const deduped = new Map<string, ItemCruzado>()
  for (const it of items) deduped.set(it.item_key, it)

  return {
    items: Array.from(deduped.values()),
    diagnostico: {
      total_auditorias: auditorias.length,
      con_pgo:    conPgo,
      sin_pgo:    Array.from(sinPgo),
      con_cortes: conCortes,
      sin_match:  sinMatch,
    },
  }
}
