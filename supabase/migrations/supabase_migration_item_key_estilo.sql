-- ============================================================================
-- Migración: agregar "estilo" al item_key (PO|Estilo|Color|Semana).
-- Todo en una sola transacción: si detecta claves nuevas duplicadas, aborta
-- automáticamente sin dejar nada a medias.
-- ============================================================================

begin;

create extension if not exists unaccent;

create temp table item_key_map as
with base as (
  select
    s.item_key as old_item_key,
    case when coalesce(s.po,'')     <> '' then s.po     else split_part(s.item_key,'|',1) end as po_raw,
    case when coalesce(s.color,'')  <> '' then s.color  else split_part(s.item_key,'|',2) end as color_raw,
    case when coalesce(s.semana,'') <> '' then s.semana else split_part(s.item_key,'|',3) end as semana_raw,
    s.estilo as estilo_col
  from seguimiento s
),
resuelto as (
  select
    b.*,
    coalesce(
      nullif(b.estilo_col, ''),
      (
        select c.estilo
        from carga_actual c
        where trim(regexp_replace(upper(c.po), '\s+', ' ', 'g')) = trim(regexp_replace(upper(b.po_raw), '\s+', ' ', 'g'))
          and trim(regexp_replace(upper(unaccent(c.color)), '\s+', ' ', 'g')) = trim(regexp_replace(upper(unaccent(b.color_raw)), '\s+', ' ', 'g'))
          and trim(regexp_replace(upper(unaccent(c.semana)), '\s+', ' ', 'g')) = trim(regexp_replace(upper(unaccent(b.semana_raw)), '\s+', ' ', 'g'))
        limit 1
      )
    ) as estilo_final
  from base b
)
select
  old_item_key,
  po_raw, estilo_final, color_raw, semana_raw,
  trim(regexp_replace(upper(po_raw), '\s+', ' ', 'g'))
    || '|' || trim(regexp_replace(upper(unaccent(coalesce(estilo_final,''))), '\s+', ' ', 'g'))
    || '|' || trim(regexp_replace(upper(unaccent(color_raw)), '\s+', ' ', 'g'))
    || '|' || trim(regexp_replace(upper(unaccent(semana_raw)), '\s+', ' ', 'g'))
    as new_item_key
from resuelto;

-- Si hay claves nuevas duplicadas, aborta toda la transacción (no se aplica nada).
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (select new_item_key from item_key_map group by new_item_key having count(*) > 1) d;

  if dup_count > 0 then
    raise exception 'Se encontraron % new_item_key duplicados, abortando migración', dup_count;
  end if;
end $$;

update comentarios c
set item_key = m.new_item_key
from item_key_map m
where c.item_key = m.old_item_key
  and m.old_item_key <> m.new_item_key;

update seguimiento s
set item_key = m.new_item_key,
    po     = coalesce(nullif(s.po,''), m.po_raw),
    color  = coalesce(nullif(s.color,''), m.color_raw),
    semana = coalesce(nullif(s.semana,''), m.semana_raw),
    estilo = coalesce(nullif(s.estilo,''), m.estilo_final)
from item_key_map m
where s.item_key = m.old_item_key
  and m.old_item_key <> m.new_item_key;

drop table item_key_map;

commit;

-- Nota: "carga_actual" no necesita esto: se regenera entera en cada
-- "Publicar semana completa".
