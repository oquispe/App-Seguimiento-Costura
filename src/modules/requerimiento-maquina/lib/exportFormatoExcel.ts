import ExcelJS from 'exceljs'
import type { BalanceReport, FormatoInstalacion, OperacionFormato, RolFirmaOperacion } from '../types'

const COLOR_HEADER_BG = 'FF1E40AF'
const COLOR_HEADER_FONT = 'FFFFFFFF'
const COLOR_BORDER = 'FF94A3B8'
const COLOR_TITLE = 'FF0F172A'
const COLOR_SUBTITLE = 'FF475569'
const COLOR_NORMAL = 'FF1E293B'
const COLOR_FIRMADO = 'FF059669'
const COLOR_PENDIENTE = 'FFDC2626'

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: COLOR_BORDER } },
  left: { style: 'thin' as const, color: { argb: COLOR_BORDER } },
  bottom: { style: 'thin' as const, color: { argb: COLOR_BORDER } },
  right: { style: 'thin' as const, color: { argb: COLOR_BORDER } },
}

const centrado = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }
const izquierda = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }

/** Parsea "HH:MM" y devuelve minutos transcurridos entre dos horas del mismo día. */
function calcularMinutos(hInicio?: string, hFin?: string): number | '' {
  if (!hInicio || !hFin) return ''
  const [h1, m1] = hInicio.split(':').map(Number)
  const [h2, m2] = hFin.split(':').map(Number)
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return ''
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

function minutosDesdeInicio(hInicio: string | undefined, horaFirma: string | undefined): string {
  const mins = calcularMinutos(hInicio, horaFirma)
  return mins === '' ? '' : `\n(${mins} min)`
}

const ROLES_FIRMA_COL: { rol: RolFirmaOperacion; letra: 'H' | 'I' | 'J' | 'K' }[] = [
  { rol: 'mecanico', letra: 'H' },
  { rol: 'operario', letra: 'I' },
  { rol: 'supervisor', letra: 'J' },
  { rol: 'auditor', letra: 'K' },
]

/**
 * Puerto TS de `create_formato_excel_web` (Proyecto_Balance/Balance/server.py:1731-1985):
 * mismo layout de 12 columnas (título, datos generales, encabezado azul,
 * filas combinadas por operario, celdas de firma en verde con minutos
 * transcurridos, plantilla fija de 30 ítems, pie con firmas de jefe de
 * sector/analista).
 */
export async function exportarFormatoExcel(
  reporte: BalanceReport,
  formato: FormatoInstalacion
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Instalacion Cambio de Estilo')

  ws.mergeCells('A1:L1')
  const titulo = ws.getCell('A1')
  titulo.value = 'INSTALACION DE CAMBIO DE ESTILO'
  titulo.font = { name: 'Arial', size: 16, bold: true, color: { argb: COLOR_TITLE } }
  titulo.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 35

  const datoGeneral = (fila: number, etiquetaCol: string, etiqueta: string, valorCol: string, valor: string) => {
    ws.mergeCells(`${etiquetaCol}${fila}:${String.fromCharCode(etiquetaCol.charCodeAt(0) + 1)}${fila}`)
    const celdaEtiqueta = ws.getCell(`${etiquetaCol}${fila}`)
    celdaEtiqueta.value = etiqueta
    celdaEtiqueta.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_SUBTITLE } }
    const celdaValor = ws.getCell(`${valorCol}${fila}`)
    celdaValor.value = valor
    celdaValor.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
    celdaValor.border = thinBorder
    celdaValor.alignment = centrado
  }

  datoGeneral(3, 'A', 'LINEA:', 'C', reporte.linea ?? '')
  datoGeneral(4, 'A', 'ESTILO SALIENTE:', 'C', formato.estilo_saliente ?? '')
  datoGeneral(5, 'A', 'ESTILO ENTRANTE:', 'C', reporte.estilo_cliente ?? '')

  ws.mergeCells('A6:B6')
  const etiquetaInicio = ws.getCell('A6')
  etiquetaInicio.value = 'FECHA INICIO:'
  etiquetaInicio.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_SUBTITLE } }
  const valorInicio = ws.getCell('C6')
  valorInicio.value = formato.fecha_inicio ?? ''
  valorInicio.border = thinBorder
  valorInicio.alignment = centrado
  const etiquetaFin = ws.getCell('D6')
  etiquetaFin.value = 'FECHA FIN:'
  etiquetaFin.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_SUBTITLE } }
  ws.mergeCells('E6:F6')
  const valorFin = ws.getCell('E6')
  valorFin.value = formato.fecha_fin ?? ''
  valorFin.border = thinBorder
  ws.getCell('F6').border = thinBorder
  valorFin.alignment = centrado

  const filaEncabezado = 8
  const headers = [
    'ITEM', 'OPERARIO', 'OPERACION', 'H. INICIO', 'H. FIN', 'MINUTOS', 'TIPO MAQUINA',
    'FIRMA\nMECÁNICO', 'FIRMA\nOPERARIO', 'FIRMA\nSUPERVISOR', 'FIRMA\nAUDITOR', 'COMENTARIOS',
  ]
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  cols.forEach((col, i) => {
    const cell = ws.getCell(`${col}${filaEncabezado}`)
    cell.value = headers[i]
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_HEADER_FONT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
    cell.alignment = centrado
    cell.border = thinBorder
  })
  ws.getRow(filaEncabezado).height = 30

  let dataRow = filaEncabezado + 1
  let itemNum = 1

  for (const op of reporte.operarios) {
    const operaciones = op.operaciones.filter((o) => o.codigo)
    if (operaciones.length === 0) continue

    const numOps = operaciones.length
    const startRow = dataRow

    operaciones.forEach((operacion, j) => {
      const opKey = `${op.item}_${operacion.codigo}`
      const opData: OperacionFormato = formato.operaciones_json[opKey] ?? {}
      const hInicio = opData.h_inicio ?? ''
      const hFin = opData.h_fin ?? ''
      const minutos = calcularMinutos(hInicio, hFin)

      if (j === 0) {
        const celdaItem = ws.getCell(`A${dataRow}`)
        celdaItem.value = itemNum
        celdaItem.alignment = centrado
        celdaItem.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
        celdaItem.border = thinBorder
        if (numOps > 1) ws.mergeCells(startRow, 1, startRow + numOps - 1, 1)

        const celdaNombre = ws.getCell(`B${dataRow}`)
        celdaNombre.value = op.nombre
        celdaNombre.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
        celdaNombre.alignment = izquierda
        celdaNombre.border = thinBorder
        if (numOps > 1) ws.mergeCells(startRow, 2, startRow + numOps - 1, 2)
      }

      const celdaDescripcion = ws.getCell(`C${dataRow}`)
      celdaDescripcion.value = operacion.descripcion
      celdaDescripcion.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaDescripcion.alignment = izquierda
      celdaDescripcion.border = thinBorder

      const celdaInicio = ws.getCell(`D${dataRow}`)
      celdaInicio.value = hInicio
      celdaInicio.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaInicio.alignment = centrado
      celdaInicio.border = thinBorder

      const celdaFin = ws.getCell(`E${dataRow}`)
      celdaFin.value = hFin
      celdaFin.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaFin.alignment = centrado
      celdaFin.border = thinBorder

      const celdaMinutos = ws.getCell(`F${dataRow}`)
      celdaMinutos.value = minutos
      celdaMinutos.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaMinutos.alignment = centrado
      celdaMinutos.border = thinBorder

      const celdaMaquina = ws.getCell(`G${dataRow}`)
      celdaMaquina.value = operacion.maquina
      celdaMaquina.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaMaquina.alignment = centrado
      celdaMaquina.border = thinBorder

      for (const { rol, letra } of ROLES_FIRMA_COL) {
        const firmado = !!opData[`firma_${rol}` as const]
        const horaFirma = opData[`hora_firma_${rol}` as const]
        const celda = ws.getCell(`${letra}${dataRow}`)
        celda.value = (firmado ? 'FIRMADO' : '') + minutosDesdeInicio(hInicio, horaFirma)
        celda.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_FIRMADO } }
        celda.alignment = centrado
        celda.border = thinBorder
      }

      const celdaComentario = ws.getCell(`L${dataRow}`)
      celdaComentario.value = opData.comentario ?? ''
      celdaComentario.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
      celdaComentario.alignment = izquierda
      celdaComentario.border = thinBorder

      ws.getRow(dataRow).height = 28
      dataRow += 1
    })

    itemNum += 1
  }

  while (itemNum <= 30) {
    const celdaItem = ws.getCell(`A${dataRow}`)
    celdaItem.value = itemNum
    celdaItem.alignment = centrado
    celdaItem.font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
    celdaItem.border = thinBorder
    for (const col of cols.slice(1)) {
      ws.getCell(`${col}${dataRow}`).border = thinBorder
    }
    ws.getRow(dataRow).height = 28
    dataRow += 1
    itemNum += 1
  }

  dataRow += 2
  ws.mergeCells(`A${dataRow}:E${dataRow}`)
  ws.getCell(`A${dataRow}`).value = '________________________________'
  ws.getCell(`A${dataRow}`).alignment = centrado
  ws.getCell(`A${dataRow}`).font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }
  ws.mergeCells(`F${dataRow}:J${dataRow}`)
  ws.getCell(`F${dataRow}`).value = '________________________________'
  ws.getCell(`F${dataRow}`).alignment = centrado
  ws.getCell(`F${dataRow}`).font = { name: 'Arial', size: 10, color: { argb: COLOR_NORMAL } }

  dataRow += 1
  ws.mergeCells(`A${dataRow}:E${dataRow}`)
  ws.getCell(`A${dataRow}`).value = 'Jefe de Sector'
  ws.getCell(`A${dataRow}`).alignment = centrado
  ws.getCell(`A${dataRow}`).font = { name: 'Arial', size: 10, bold: true }
  ws.mergeCells(`F${dataRow}:J${dataRow}`)
  ws.getCell(`F${dataRow}`).value = 'Analista de Ingenieria'
  ws.getCell(`F${dataRow}`).alignment = centrado
  ws.getCell(`F${dataRow}`).font = { name: 'Arial', size: 10, bold: true }

  dataRow += 1
  ws.mergeCells(`A${dataRow}:E${dataRow}`)
  const celdaEstadoJefe = ws.getCell(`A${dataRow}`)
  celdaEstadoJefe.value = formato.firmas_jefe_sector ? 'FIRMADO' : 'PENDIENTE'
  celdaEstadoJefe.alignment = centrado
  celdaEstadoJefe.font = { name: 'Arial', size: 9, bold: true, color: { argb: formato.firmas_jefe_sector ? COLOR_FIRMADO : COLOR_PENDIENTE } }
  ws.mergeCells(`F${dataRow}:J${dataRow}`)
  const celdaEstadoAnalista = ws.getCell(`F${dataRow}`)
  celdaEstadoAnalista.value = formato.firmas_analista_ing ? 'FIRMADO' : 'PENDIENTE'
  celdaEstadoAnalista.alignment = centrado
  celdaEstadoAnalista.font = { name: 'Arial', size: 9, bold: true, color: { argb: formato.firmas_analista_ing ? COLOR_FIRMADO : COLOR_PENDIENTE } }

  ws.columns = [
    { width: 7 }, { width: 28 }, { width: 45 }, { width: 16 }, { width: 16 }, { width: 11 },
    { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 25 },
  ]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Instalacion_${reporte.report_key.replace(/\.[^.]+$/, '')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
