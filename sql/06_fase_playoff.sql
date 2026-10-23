-- =====================================================================
-- 06_fase_playoff.sql — Fase "Playoff" para cuando no se sabe la instancia
-- (por ejemplo 2016C-PLA-P y 2018A-PLA-P del Excel).
-- Correr después de 05 y antes de volver a correr 02 y 03. Se puede volver a correr.
-- Qué se rompe: nada. Solo amplía los valores permitidos de partidos.fase.
-- En las campañas, "Playoff" cuenta como la instancia más baja.
-- En una base nueva no hace falta: 01 y 05 ya lo incluyen.
-- =====================================================================

alter table partidos drop constraint if exists partidos_fase_chk;
alter table partidos add constraint partidos_fase_chk check (fase in (
  'Regular', 'Zona', 'Interzonal', 'Grupos', '32avos', '16avos',
  'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Playoff'));

-- Código del ID para partidos nuevos cargados desde la app (2018A-PLA-P)
create or replace function codigo_instancia(p_fase text, p_fecha_nro int, p_serie text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_fase
      when 'Regular' then 'F' || lpad(p_fecha_nro::text, 2, '0')
      when 'Zona' then 'Z' || lpad(p_fecha_nro::text, 2, '0')
      when 'Interzonal' then 'I' || lpad(p_fecha_nro::text, 2, '0')
      when 'Grupos' then 'G' || lpad(p_fecha_nro::text, 2, '0')
      when '32avos' then '32A' when '16avos' then '16A' when 'Octavos' then 'OCT'
      when 'Cuartos' then 'CUA' when 'Semifinal' then 'SEM' when 'Final' then 'FIN' when 'Playoff' then 'PLA'
    end
    || case p_serie when 'Ida' then 'I' when 'Vuelta' then 'V' else '' end
$$;
