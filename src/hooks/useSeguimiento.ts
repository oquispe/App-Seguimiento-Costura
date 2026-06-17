import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SeguimientoRecord, ComentarioRecord, ItemCruzado } from '../types'

export function useSeguimiento() {
  const cargarSeguimiento = useCallback(async (itemKeys: string[]) => {
    if (itemKeys.length === 0) return []
    const { data, error } = await supabase
      .from('seguimiento')
      .select('*')
      .in('item_key', itemKeys)
    if (error) throw error
    return (data ?? []) as SeguimientoRecord[]
  }, [])

  const guardarSeguimiento = useCallback(async (item: ItemCruzado) => {
    const record: SeguimientoRecord = {
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
    }
    const { error } = await supabase
      .from('seguimiento')
      .upsert(record, { onConflict: 'item_key' })
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

  const cargarComentarios = useCallback(async (item_key: string) => {
    const { data, error } = await supabase
      .from('comentarios')
      .select('*')
      .eq('item_key', item_key)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as ComentarioRecord[]
  }, [])

  return { cargarSeguimiento, guardarSeguimiento, agregarComentario, cargarComentarios }
}
