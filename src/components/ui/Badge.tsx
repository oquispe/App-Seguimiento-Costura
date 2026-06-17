import type { ReactNode } from 'react'

type Variant = 'rojo' | 'ambar' | 'verde' | 'sin-fecha' | 'brand' | 'slate' | 'teal' | 'cyan'

const CLASSES: Record<Variant, string> = {
  rojo: 'bg-red-100 text-red-700 border border-red-200',
  ambar: 'bg-amber-100 text-amber-700 border border-amber-200',
  verde: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'sin-fecha': 'bg-gray-100 text-gray-500 border border-gray-200',
  brand: 'bg-blue-100 text-blue-700 border border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border border-slate-200',
  teal: 'bg-teal-100 text-teal-700 border border-teal-200',
  cyan: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
}

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
  title?: string
}

export function Badge({ variant = 'slate', children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
