import { useRef, useState, useCallback } from 'react'
import { Upload, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { ParseResult } from '../../types'

interface DropZoneProps<T> {
  label: string
  accept?: string
  onParsed: (result: ParseResult<T>, buffer: ArrayBuffer) => void
  parse: (buffer: ArrayBuffer) => ParseResult<T>
  result: ParseResult<T> | null
  loading?: boolean
}

export function DropZone<T>({ label, accept = '.xlsx,.xlsm,.xls', onParsed, parse, result, loading }: DropZoneProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer()
      const res = parse(buf)
      onParsed(res, buf)
    },
    [parse, onParsed]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const statusIcon = result
    ? result.columnasFaltantes.length > 0
      ? <AlertTriangle className="w-5 h-5 text-amber-500" />
      : result.errores.length > 0
        ? <XCircle className="w-5 h-5 text-red-500" />
        : <CheckCircle className="w-5 h-5 text-emerald-500" />
    : null

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-400 hover:bg-surface'
        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-ink-muted" />
          <div>
            <span className="text-sm font-medium text-ink">{label}</span>
            <p className="text-xs text-ink-muted mt-0.5">Arrastra o haz clic para seleccionar</p>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-lg p-3 text-xs border ${
          result.columnasFaltantes.length > 0 ? 'bg-amber-50 border-amber-200' :
          result.errores.length > 0 ? 'bg-red-50 border-red-200' :
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2 font-medium mb-1">
            {statusIcon}
            <span>
              {result.validas} válidas · {result.leidas} leídas · {result.omitidas} omitidas
            </span>
          </div>
          {result.columnasFaltantes.length > 0 && (
            <p className="text-amber-700">
              Columnas no reconocidas: {result.columnasFaltantes.join(', ')}
            </p>
          )}
          {result.errores.map((err, i) => (
            <p key={i} className="text-red-700 mt-0.5">{err}</p>
          ))}
        </div>
      )}
    </div>
  )
}
