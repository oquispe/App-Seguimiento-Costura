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

  // Índice Cortes: preferir PO+COLOR exacto, fallback a PO
  const cortesIdxFull = new Map<string, CortesRow>() // PO|COLOR
  const cortesIdxPO   = new Map<string, CortesRow>() // solo PO (fallback)
  for (const c of cortes) {
    const kFull = `${normalizePO(c.po)}|${normalize(c.color)}`
    const kPO   = normalizePO(c.po)
    if (!cortesIdxFull.has(kFull)) cortesIdxFull.set(kFull, c)
    if (!cortesIdxPO.has(kPO))   cortesIdxPO.set(kPO, c)
  }

  const items: ItemCruzado[] = []
  const sinPgo: Set<string> = new Set()
  const cerrados: Set<string> = new Set()
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

    // Cruce Cortes: intentar PO+COLOR primero, luego PO solo
    const corte = cortesIdxFull.get(`${crucePO}|${cruceColor}`)
               ?? cortesIdxPO.get(crucePO)
               ?? null

    if (pgo) conPgo++
    else sinPgo.add(crucePO)

    // Si el PO no aparece en Status Cortes, se asume que ya salió de producción
    // (producción 100% cerrada, lista para auditar) en vez de marcarlo como dato faltante.
    const produccionCerrada = corte === null
    if (corte) conCortes++
    else cerrados.add(crucePO)

    const totalRequeridas = corte?.total_requeridas ?? (produccionCerrada ? aud.cant_prog ?? 0 : 0)
    const piezasAcabadas  = corte?.piezas_acabadas  ?? (produccionCerrada ? aud.cant_prog ?? 0 : 0)
    const enAcabados      = corte?.en_acabados      ?? (produccionCerrada ? aud.cant_prog ?? 0 : 0)

    const diasFinal = diasRestantes(pgo?.auditoria_final ?? null)
    const item_key  = makeItemKey(aud.po, aud.color, aud.semana)

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
      fin_entrega:    pgo?.fin_entrega    ?? null,
      auditoria:      pgo?.auditoria      ?? null,
      auditoria_final: pgo?.auditoria_final ?? null,
      // Ruta y etapas de producción (de Cortes)
      ruta:                corte?.ruta                ?? '',
      en_estanteria:       corte?.en_estanteria       ?? 0,
      en_proceso:          corte?.en_proceso          ?? 0,
      confeccionadas:      corte?.confeccionadas      ?? 0,
      en_bordado:          corte?.en_bordado          ?? 0,
      bordadas:            corte?.bordadas            ?? 0,
      en_estampado:        corte?.en_estampado        ?? 0,
      estampadas:          corte?.estampadas          ?? 0,
      en_transfer:         corte?.en_transfer         ?? 0,
      transfer_terminadas: corte?.transfer_terminadas ?? 0,
      en_lavanderia:       corte?.en_lavanderia       ?? 0,
      lavadas:             corte?.lavadas             ?? 0,
      ingresos_acabados_1ra: corte?.ingresos_acabados_1ra ?? 0,
      ingresos_acabados_2da: corte?.ingresos_acabados_2da ?? 0,
      en_acabados:         enAcabados,
      piezas_acabadas:     piezasAcabadas,
      total_requeridas:    totalRequeridas,
      linea_costura:       corte?.linea_costura       ?? '',
      produccion_cerrada:  produccionCerrada,
      // Semáforo
      dias_fin_entrega:    diasRestantes(pgo?.fin_entrega ?? null),
      dias_auditoria_final: diasFinal,
      semaforo:            calcularSemaforo(diasFinal),
      // Defaults de seguimiento (se sobreescribirán con datos de Supabase)
      estado:          'Pendiente',
      resultado:       null,
      fecha_solicitada: null,
      fecha_auditoria:  null,
      solicitado_por:  null,
      responsable:     null,
      compromisos:     {},
    })
  }

  // Deduplicar por item_key: si Auditorías tiene la misma PO+COLOR+SEMANA duplicada,
  // quedarse con la última ocurrencia (la que sobreescribiría en la BD de todas formas)
  const deduped = new Map<string, ItemCruzado>()
  for (const it of items) deduped.set(it.item_key, it)
  const itemsUnicos = Array.from(deduped.values())

  return {
    items: itemsUnicos,
    diagnostico: {
      total_auditorias: auditorias.length,
      con_pgo:    conPgo,
      sin_pgo:    Array.from(sinPgo),
      con_cortes: conCortes,
      cerrados:   Array.from(cerrados),
    },
  }
}
