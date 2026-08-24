import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SeguimientoRecord, ComentarioRecord, ItemCruzado } from '../types'

export function useSeguimiento() {
  const cargarSeguimiento = useCallback(async (baseKeys: string[]) => {
    if (baseKeys.length === 0) return []
    const { data, error } = await supabase
      .from('seguimiento')
      .select('*')
      .in('base_key', baseKeys)
    if (error) throw error
    return (data ?? []) as SeguimientoRecord[]
  }, [])

  const guardarSeguimiento = useCallback(async (item: ItemCruzado) => {
    const record: SeguimientoRecord = {
      base_key:        item.base_key,
      item_key:        item.item_key,
      cliente:         item.cliente,
      estilo:          item.estilo,
      po:              item.po,
      color:           item.color,
      cant_prog:       item.cant_prog,
      externa:         item.externa,
      semana:          item.semana,
      estado:          item.estado,
      resultado:       item.resultado,
      fecha_solicitada: item.fecha_solicitada,
      fecha_auditoria: item.fecha_auditoria,
      solicitado_por:  item.solicitado_por,
      responsable:     item.responsable,
      compromisos:     item.compromisos ?? null,
      compromisos_linea: item.compromisos_linea ?? null,
      auditoria_final_override: item.auditoria_final_override ?? null,
    }
    const { error } = await supabase
      .from('seguimiento')
      .upsert(record, { onConflict: 'base_key' })
    if (error) throw error
  }, [])

  const agregarComentario = useCallback(
    async (comentario: Omit<ComentarioRecord, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('comentarios')
        .insert(comentario)
      if (error) throw error
    },
    []
  )

  const cargarComentarios = useCallback(async (base_key: string) => {
    const { data, error } = await supabase
      .from('comentarios')
      .select('*')
      .eq('base_key', base_key)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as ComentarioRecord[]
  }, [])

  return { cargarSeguimiento, guardarSeguimiento, agregarComentario, cargarComentarios }
}
