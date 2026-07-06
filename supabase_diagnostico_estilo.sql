-- Diagnóstico (solo lectura): para las filas de "seguimiento" con po/estilo/color/semana
-- vacíos, intenta recuperar esos valores parseando el item_key viejo (formato PO|Color|Semana)
-- y cruzando contra "carga_actual" (que sí tiene estilo correcto y fresco) para saber
-- cuántas filas se pueden resolver sin ambigüedad y cuántas quedan en duda.

create extension if not exists unaccent;

with parsed as (
  select
    s.item_key as old_item_key,
    s.estado,
    split_part(s.item_key, '|', 1) as po_parsed,
    split_part(s.item_key, '|', 2) as color_parsed,
    split_part(s.item_key, '|', 3) as semana_parsed
  from seguimiento s
  where coalesce(s.po, '') = ''
    and coalesce(s.estilo, '') = ''
    and coalesce(s.color, '') = ''
    and coalesce(s.semana, '') = ''
),
candidatos as (
  select
    p.old_item_key,
    p.estado,
    p.po_parsed,
    p.color_parsed,
    p.semana_parsed,
    c.estilo as estilo_candidato
  from parsed p
  left join carga_actual c
    on trim(regexp_replace(upper(c.po), '\s+', ' ', 'g')) = p.po_parsed
   and trim(regexp_replace(upper(unaccent(c.color)), '\s+', ' ', 'g')) = p.color_parsed
   and trim(regexp_replace(upper(unaccent(c.semana)), '\s+', ' ', 'g')) = p.semana_parsed
)
select
  old_item_key,
  estado,
  count(distinct estilo_candidato) filter (where estilo_candidato is not null) as n_estilos_candidatos,
  string_agg(distinct estilo_candidato, ', ') as estilos_candidatos
from candidatos
group by old_item_key, estado
order by n_estilos_candidatos desc, old_item_key;
