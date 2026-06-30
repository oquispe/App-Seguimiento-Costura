import { normalizePO, normalize, makeItemKey } from './normalize'
import { diasRestantes, calcularSemaforo } from './dateUtils'
import type {
  AuditoriaRow,
  PgoRow,
  CortesRow,
  ItemCruzado,
  DiagnosticoCruce,
  LlaveCruce,
} from '../../types'

/**
 * Normaliza el color para matching flexible:
 * 1. "NAVY - NAVY"         → "NAVY"          (duplicado separado por guión)
 * 2. "0421 - Breaker Blue" → "BREAKER BLUE"  (código numérico al inicio)
 * 3. "NAVY BLUE"           → "NAVY BLUE"     (sin cambio)
 */
function stripColorCode(color: string): string {
  const norm = normalize(color)
  const parts = norm.split(/\s*[-–]\s*/)
  if (parts.length !== 2) return norm

  const left  = parts[0].trim()
  const right = parts[1].trim()

  // Caso 1: "X - X" (mismo texto a ambos lados) → "X"
  if (left === right) return left

  // Caso 2: código numérico al inicio "0421 - Breaker Blue" → "BREAKER BLUE"
  if (/^\d{3,5}$/.test(left)) return right

  // Caso 3: código alfa-corto sin espacios "MRPNK - MELROSE PINK" → "MELROSE PINK"
  // El código (izq) no tiene espacios, ≤8 chars y es más corto que el nombre (der)
  if (!left.includes(' ') && left.length <= 8 && right.length > left.length) return right

  return norm
}

/**
 * Busca la mejor fila de Cortes para un PO+Color de Auditorías.
 * Fuente de verdad: el Status y el PGO tienen el color correcto;
 * el Excel de Auditorías puede tener variaciones o errores de escritura.
 *
 * Prioridad:
 * 1. PO + Color exacto (normalizado)
 * 2. PO + Color sin código numérico ("0421 - Breaker Blue" ≈ "Breaker Blue")
 * 3. PO con un único color en Cortes (no hay ambigüedad)
 * 4. null → produccion_cerrada
 */
function buscarCorte(
  crucePO: string,
  auditColor: string,
  cortesPorPO: Map<string, CortesRow[]>
): CortesRow | null {
  const candidatos = cortesPorPO.get(crucePO)
  if (!candidatos || candidatos.length === 0) return null

  const auditColorNorm   = normalize(auditColor)
  const auditColorStrip  = stripColorCode(auditColor)

  // 1. Exacto
  const exacto = candidatos.find(c => normalize(c.color) === auditColorNorm)
  if (exacto) return exacto

  // 2. Sin código de color (numérico o alfa-corto)
  const fuzzy = candidatos.find(c => stripColorCode(c.color) === auditColorStrip)
  if (fuzzy) return fuzzy

  // 3. Único color → no hay riesgo de cruzar datos entre colores distintos
  if (candidatos.length === 1) return candidatos[0]

  // 4. Truncación: Status truncó el nombre del color
  //    Ej: aud="WINDY BLUE / DARK OLIVE", sts="WINDY BLUE / DARK OL"
  const truncado = candidatos.find(c => {
    const cNorm = normalize(c.color)
    return cNorm.length >= 5 && (
      auditColorStrip.startsWith(cNorm) || auditColorNorm.startsWith(cNorm)
    )
  })
  if (truncado) return truncado

  // 5. Formato "ABREVIADO - NOMBRE COMPLETO" donde la abreviatura tiene espacios
  //    Ej: aud="LAVENDER AURA/WINDWA - LAVENDER AURA/WINDWARD", sts="LAVENDER AURA/WINDWA"
  //    Ej: aud="THE BUCK - PONDEROSA - THE BUCK - PONDEROSA GREEN/WHITE", sts="THE BUCK - PONDEROSA"
  const partes = auditColorNorm.split(/\s*[-–]\s*/)
  for (let len = 1; len < partes.length; len++) {
    const prefijo = partes.slice(0, len).join(' - ')
    const encontrado = candidatos.find(c => normalize(c.color) === prefijo)
    if (encontrado) return encontrado
  }

  return null
}

export function cruzarDatos(
  auditorias: AuditoriaRow[],
  pgos: PgoRow[],
  cortes: CortesRow[],
  llave: LlaveCruce = 'PO'
): { items: ItemCruzado[]; diagnostico: DiagnosticoCruce } {
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

    // Cruce Cortes: búsqueda robusta (exacto → fuzzy → único color del PO)
    const corte = buscarCorte(crucePO, aud.color, cortesPorPO)

    if (pgo) conPgo++
    else sinPgo.add(crucePO)

    // Si no aparece en el reporte → sin datos de producción
    const produccionCerrada = corte === null
    if (corte) conCortes++
    else sinMatch.push({ po: aud.po, color: aud.color })

    const totalRequeridas = corte?.total_requeridas ?? (aud.cant_prog ?? 0)
    const aptFallback     = 0

    const diasFinal  = diasRestantes(pgo?.auditoria_final ?? null)
    const item_key   = makeItemKey(aud.po, aud.color, aud.semana)

    items.push({
      item_key,
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
      compromisos:      {},
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
