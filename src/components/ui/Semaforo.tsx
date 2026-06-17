import type { Semaforo } from '../../lib/parsers/dateUtils'

const DOT_CLASSES: Record<Semaforo, string> = {
  rojo: 'bg-red-500',
  ambar: 'bg-amber-400',
  verde: 'bg-emerald-500',
  'sin-fecha': 'bg-gray-300',
}

const LABEL: Record<Semaforo, string> = {
  rojo: 'Vencida/Urgente',
  ambar: 'Próxima (2-3 días)',
  verde: 'A tiempo',
  'sin-fecha': 'Sin fecha',
}

interface SemaforoProps {
  valor: Semaforo
  dias?: number | null
  showLabel?: boolean
}

export function SemaforoDot({ valor, dias, showLabel }: SemaforoProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT_CLASSES[valor]}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${valor === 'rojo' ? 'text-red-600' : valor === 'ambar' ? 'text-amber-600' : 'text-emerald-600'}`}>
          {dias !== null && dias !== undefined ? (dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d`) : LABEL[valor]}
        </span>
      )}
    </span>
  )
}
