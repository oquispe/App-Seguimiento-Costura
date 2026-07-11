import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, Wrench } from 'lucide-react'
import { MainPage } from '../pages/MainPage'
import { ReportesPage } from './requerimiento-maquina/pages/ReportesPage'

export interface ModuloConfig {
  id: string
  area: string
  nombre: string
  path: string
  icon: LucideIcon
  Component: ComponentType
}

export const modulos: ModuloConfig[] = [
  {
    id: 'seguimiento',
    area: 'Gerencia',
    nombre: 'Seguimiento',
    path: '/gerencia/seguimiento',
    icon: ClipboardCheck,
    Component: MainPage,
  },
  {
    id: 'requerimiento-maquina',
    area: 'Costura',
    nombre: 'Requerimiento de Máquina',
    path: '/costura/requerimiento-maquina',
    icon: Wrench,
    Component: ReportesPage,
  },
]

export interface AreaConfig {
  area: string
  modulos: ModuloConfig[]
}

export function getAreas(): AreaConfig[] {
  const areas: AreaConfig[] = []
  for (const modulo of modulos) {
    let area = areas.find((a) => a.area === modulo.area)
    if (!area) {
      area = { area: modulo.area, modulos: [] }
      areas.push(area)
    }
    area.modulos.push(modulo)
  }
  return areas
}

export const RUTA_POR_DEFECTO = modulos[0].path
