import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Trash2, Bot, Copy, Check } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ubicacionActual } from '../../lib/posicion'
import type { ItemCruzado } from '../../types'

interface Mensaje {
  id: number
  rol: 'user' | 'assistant'
  texto: string
  ts: Date
}

interface Props {
  items: ItemCruzado[]
  isOpen: boolean
  onClose: () => void
}

const ACCESOS_RAPIDOS = [
  { label: '🧵 Prioridades Costura',   query: '¿Cuáles son las prioridades de costura? Lista los ítems con piezas en proceso, del más urgente al menos urgente.' },
  { label: '🪡 Prioridades Bordado',   query: '¿Qué ítems tienen piezas en bordado? Muéstralos por urgencia.' },
  { label: '🖨️ Prioridades Estampado', query: '¿Qué ítems tienen piezas en estampado? Muéstralos por urgencia.' },
  { label: '📦 Ítems urgentes',        query: '¿Cuáles son los ítems más urgentes? Muestra los que tienen el semáforo en rojo.' },
  { label: '✅ Listos para auditar',   query: '¿Qué ítems están listos para auditar (producción completa)?' },
  { label: '📊 Resumen semana',        query: 'Dame un resumen del estado general de la semana: cuántos ítems hay, cuántos están urgentes, cuántos en cada etapa.' },
]

function compactarItem(it: ItemCruzado) {
  const fmtD = (d: Date | null | undefined) => d ? format(new Date(d), 'dd/MM/yy', { locale: es }) : null
  const pos = Object.fromEntries(ubicacionActual(it).map(u => [u.key, u.cantidad]))
  return {
    semana:               it.semana,
    cliente:              it.cliente,
    estilo:               it.estilo,
    po:                   it.po,
    op:                   it.op,
    color:                it.color,
    cant_prog:            it.cant_prog,
    externa:              it.externa,
    semaforo:             it.semaforo,
    dias_auditoria_final: it.dias_auditoria_final,
    auditoria_final:      fmtD(it.auditoria_final),
    fin_entrega:          fmtD(it.fin_entrega),
    en_corte:             pos['corte']          ?? 0,
    en_bordado:           pos['bordado']        ?? 0,
    en_costura:           pos['costura']        ?? 0,
    en_estampado:         pos['estampado']      ?? 0,
    en_estampado_ext:     pos['estampado_ext']  ?? 0,
    en_lavanderia:        pos['lavanderia']     ?? 0,
    en_costura_lineas:    pos['costura_lineas'] ?? 0,
    en_acabado:           pos['acabado']        ?? 0,
    apt:                  it.apt,
    total_requeridas:     it.total_requeridas,
    estado:               it.estado,
  }
}

// ─── Renderer de Markdown simple ─────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

function MarkdownMsg({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-line my-2" />)
    } else if (line.startsWith('## ')) {
      nodes.push(
        <p key={i} className="text-sm font-bold text-ink mt-3 mb-1">
          {renderInline(line.slice(3))}
        </p>
      )
    } else if (line.startsWith('### ')) {
      nodes.push(
        <p key={i} className="text-sm font-semibold text-ink mt-2 mb-0.5">
          {renderInline(line.slice(4))}
        </p>
      )
    } else if (/^[-*] /.test(line)) {
      nodes.push(
        <div key={i} className="flex gap-1.5 text-sm leading-snug">
          <span className="text-ink-muted mt-0.5 shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      nodes.push(
        <div key={i} className="flex gap-1.5 text-sm leading-snug">
          <span className="text-ink-muted shrink-0 w-4 text-right">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />)
    } else {
      nodes.push(
        <p key={i} className="text-sm leading-snug">
          {renderInline(line)}
        </p>
      )
    }
    i++
  }
  return <div className="space-y-0.5">{nodes}</div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      title="Copiar respuesta"
      className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors"
    >
      {copied
        ? <><Check className="w-3 h-3 text-teal-600" /><span className="text-teal-600">Copiado</span></>
        : <><Copy className="w-3 h-3" /><span>Copiar</span></>}
    </button>
  )
}

let nextId = 1

export function ChatBot({ items, isOpen, onClose }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: nextId++,
      rol: 'assistant',
      texto: '¡Hola! Soy el asistente de producción CMT. Puedo ayudarte a consultar prioridades por área, estado de POs, ítems urgentes y más. ¿Qué necesitas?',
      ts: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes, isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const enviar = useCallback(async (texto: string) => {
    const pregunta = texto.trim()
    if (!pregunta || cargando) return

    const msgUser: Mensaje = { id: nextId++, rol: 'user', texto: pregunta, ts: new Date() }
    setMensajes((prev) => [...prev, msgUser])
    setInput('')
    setCargando(true)

    // Historial para el contexto (sin el primer mensaje de bienvenida)
    const historial = mensajes
      .filter((m) => m.id !== 1)
      .slice(-8)
      .map((m) => ({ rol: m.rol, texto: m.texto }))

    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: pregunta,
          historial,
          items: items.map(compactarItem),
        }),
      })
      const rawText = await res.text()
      let texto: string
      try {
        const json = JSON.parse(rawText) as { respuesta?: string; error?: string }
        texto = json.respuesta ?? json.error ?? 'Sin respuesta.'
      } catch {
        texto = `Error HTTP ${res.status}: ${rawText.slice(0, 300)}`
      }
      setMensajes((prev) => [...prev, { id: nextId++, rol: 'assistant', texto, ts: new Date() }])
    } catch (err) {
      setMensajes((prev) => [...prev, {
        id: nextId++,
        rol: 'assistant',
        texto: `Error: ${err instanceof Error ? err.message : String(err)}`,
        ts: new Date(),
      }])
    } finally {
      setCargando(false)
    }
  }, [mensajes, items, cargando])

  const limpiar = useCallback(() => {
    setMensajes([{
      id: nextId++,
      rol: 'assistant',
      texto: '¡Hola! Conversación reiniciada. ¿En qué puedo ayudarte?',
      ts: new Date(),
    }])
  }, [])

  if (!isOpen) return null

  return (
    <>
      {/* Panel del chat */}
      {true && (
        <div className="fixed bottom-20 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-line z-50 flex flex-col overflow-hidden"
          style={{ height: '520px' }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-600 shrink-0">
            <Bot className="w-5 h-5 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">Asistente CMT</p>
              <p className="text-[11px] text-white/60">{items.length} ítems en seguimiento</p>
            </div>
            <button onClick={limpiar} title="Limpiar conversación"
              className="p-1 rounded hover:bg-white/10 transition-colors">
              <Trash2 className="w-4 h-4 text-white/70" />
            </button>
            <button onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Accesos rápidos */}
          <div className="px-3 py-2 border-b border-line bg-surface flex gap-1.5 overflow-x-auto shrink-0 scrollbar-hide">
            {ACCESOS_RAPIDOS.map((a) => (
              <button
                key={a.label}
                onClick={() => enviar(a.query)}
                disabled={cargando}
                className="shrink-0 text-[11px] bg-white border border-line rounded-full px-2.5 py-1 text-ink-muted hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {mensajes.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.rol === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {m.rol === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-brand-100 grid place-items-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  m.rol === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-sm text-sm leading-relaxed'
                    : 'bg-surface text-ink rounded-tl-sm border border-line'
                }`}>
                  {m.rol === 'assistant'
                    ? <>
                        <MarkdownMsg text={m.texto} />
                        <CopyButton text={m.texto} />
                      </>
                    : m.texto}
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-100 grid place-items-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-3 py-2">
                  <Spinner size="sm" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-line bg-white shrink-0 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar(input)
                }
              }}
              placeholder="Escribe tu consulta..."
              className="flex-1 border border-line rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-24"
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={() => enviar(input)}
              disabled={!input.trim() || cargando}
              className="self-end bg-brand-600 text-white p-2 rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </>
  )
}
