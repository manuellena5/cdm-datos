-- =====================================================================
-- 05_admin.sql — Modo administrador: quién puede escribir, auditoría y
-- funciones de guardado. Correr después de 01 a 04. Se puede volver a correr.
--
-- Escribir solo pueden los usuarios de la tabla administradores (no cualquier
-- usuario con sesión). Además, desactivar el registro de usuarios en Supabase.
-- Para sumar un administrador (una vez creado el usuario en Authentication):
--   insert into administradores (user_id, nombre)
--   select id, 'Manuel' from auth.users where email = 'tu@correo';
-- Qué se rompe: nada. Son tablas, políticas y funciones nuevas; la lectura sigue igual.
-- =====================================================================

-- ---------- Administradores ----------
create table if not exists administradores (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,               -- el que se muestra en el registro de cambios
  creado_en  timestamptz not null default now()
);
alter table administradores enable row level security;
drop policy if exists lectura_propia on administradores;
create policy lectura_propia on administradores for select to authenticated using (user_id = auth.uid());
revoke all on administradores from anon;
grant select on administradores to authenticated;

-- security definer: consulta la tabla sin depender de sus políticas.
create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid())
$$;
revoke execute on function es_admin() from public, anon;
grant execute on function es_admin() to authenticated;

-- ---------- Escritura solo para administradores ----------
do $$
declare
  t text;
begin
  foreach t in array array['partidos', 'goles', 'incidencias', 'jugadores', 'fuentes',
                           'equipos', 'formaciones', 'sanciones', 'goleadores_liga'] loop
    execute format('drop policy if exists escritura_admin on %I', t);
    execute format('create policy escritura_admin on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
    execute format('revoke insert, update, delete, truncate on %I from anon', t);
    execute format('grant insert, update, delete on %I to authenticated', t);
  end loop;
end;
$$;
grant usage on all sequences in schema public to authenticated;

-- ---------- Auditoría ----------
create table if not exists auditoria (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  transaccion  bigint not null default txid_current(),   -- agrupa un mismo guardado
  usuario_id   uuid,
  usuario      text not null,                            -- nombre del administrador o 'Importación'
  tabla        text not null,
  registro     text not null,
  partido_id   text,
  accion       text not null constraint auditoria_accion_chk check (accion in ('alta', 'cambio', 'baja')),
  antes        jsonb,
  despues      jsonb,
  es_prueba    boolean not null default false
);
create index if not exists auditoria_fecha_idx on auditoria (fecha desc);
create index if not exists auditoria_registro_idx on auditoria (tabla, registro);
alter table auditoria enable row level security;
drop policy if exists lectura_admin on auditoria;
create policy lectura_admin on auditoria for select to authenticated using (es_admin());
revoke all on auditoria from anon;
grant select on auditoria to authenticated;

-- Trigger: una fila por alta, cambio real o baja. security definer para poder
-- escribir en auditoria (que no tiene políticas de escritura).
create or replace function registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_despues jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_fila    jsonb := coalesce(v_despues, v_antes);
  v_usuario text;
begin
  if tg_op = 'UPDATE' and (v_antes - 'actualizado_en') = (v_despues - 'actualizado_en') then
    return new;   -- no cambió nada
  end if;
  select nombre into v_usuario from public.administradores where user_id = auth.uid();
  insert into public.auditoria (usuario_id, usuario, tabla, registro, partido_id, accion, antes, despues, es_prueba)
  values (
    auth.uid(),
    coalesce(v_usuario, 'Importación'),
    tg_table_name,
    coalesce(v_fila ->> 'gol_id', v_fila ->> 'id', v_fila ->> 'partido_id', v_fila ->> 'jugador_id', v_fila ->> 'equipo_id'),
    v_fila ->> 'partido_id',
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
    v_antes,
    v_despues,
    coalesce(current_setting('cdm.prueba', true), '') = 'si'
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists partidos_auditoria on partidos;
create trigger partidos_auditoria after insert or update or delete on partidos
  for each row execute function registrar_cambio();
drop trigger if exists goles_auditoria on goles;
create trigger goles_auditoria after insert or update or delete on goles
  for each row execute function registrar_cambio();
drop trigger if exists incidencias_auditoria on incidencias;
create trigger incidencias_auditoria after insert or update or delete on incidencias
  for each row execute function registrar_cambio();
drop trigger if exists jugadores_auditoria on jugadores;
create trigger jugadores_auditoria after insert or update or delete on jugadores
  for each row execute function registrar_cambio();
drop trigger if exists equipos_auditoria on equipos;
create trigger equipos_auditoria after insert or update or delete on equipos
  for each row execute function registrar_cambio();

-- Registro de cambios en lenguaje simple: una fila por guardado.
drop view if exists v_cambios;
create view v_cambios with (security_invoker = true) as
select
  a.transaccion,
  min(a.fecha) as fecha,
  max(a.usuario) as usuario,
  bool_or(a.es_prueba) as es_prueba,
  count(distinct a.partido_id) as partidos,
  -- el partido de Primera si está, si no el primero
  coalesce(min(a.partido_id) filter (where a.partido_id like '%-P'), min(a.partido_id)) as partido_id,
  -- datos del partido tal como quedaron en la auditoría (sirve aunque después se haya borrado)
  (array_agg(jsonb_build_object(
      'fase', coalesce(a.despues, a.antes) ->> 'fase', 'fecha_nro', coalesce(a.despues, a.antes) ->> 'fecha_nro',
      'serie', coalesce(a.despues, a.antes) ->> 'serie', 'local_id', coalesce(a.despues, a.antes) ->> 'local_id',
      'visitante_id', coalesce(a.despues, a.antes) ->> 'visitante_id')
    order by (a.partido_id like '%-P') desc, a.id) filter (where a.tabla = 'partidos'))[1] as partido,
  -- jugadores tocados (alta, cambio o unión), con el nombre como quedó
  coalesce(jsonb_agg(jsonb_build_object(
      'accion', a.accion,
      'apellido', coalesce(a.despues, a.antes) ->> 'apellido',
      'nombre', coalesce(a.despues, a.antes) ->> 'nombre')
    order by a.accion, a.id) filter (where a.tabla = 'jugadores'), '[]'::jsonb) as jugadores,
  (array_agg(coalesce(a.despues, a.antes) ->> 'nombre_corto') filter (where a.tabla = 'equipos'))[1] as equipo,
  case
    when max(a.usuario) = 'Importación' then 'importó'
    when bool_or(a.tabla = 'partidos' and a.accion = 'baja') then 'borró'
    when bool_or(a.tabla = 'partidos' and (a.despues ->> 'publicado')::boolean
                 and coalesce((a.antes ->> 'publicado')::boolean, false) = false) then 'publicó'
    when bool_or(a.tabla = 'partidos' and (a.despues ->> 'publicado')::boolean = false) then 'guardó como borrador'
    when bool_or(a.tabla = 'jugadores' and a.accion = 'baja') then 'unió jugadores'
    when bool_or(a.tabla in ('partidos', 'goles', 'incidencias')) then 'editó'
    when bool_or(a.tabla = 'jugadores' and a.accion = 'alta') then 'agregó al jugador'
    when bool_or(a.tabla = 'jugadores') then 'corrigió al jugador'
    when bool_or(a.tabla = 'equipos') then 'cambió el escudo de'
    else 'editó'
  end as accion
from auditoria a
group by a.transaccion;
grant select on v_cambios to authenticated;

-- ---------- Funciones de carga ----------

-- Código de instancia para el ID del partido (igual que en el Excel).
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

-- Jugador nuevo con el siguiente ID (J001, J002…).
create or replace function crear_jugador(p_apellido text, p_nombre text default null, p_division text default null)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id text;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if coalesce(trim(p_apellido), '') = '' then
    raise exception 'falta el apellido' using errcode = '22023';
  end if;
  select 'J' || lpad((coalesce(max(substring(jugador_id from 2)::int), 0) + 1)::text, 3, '0')
    into v_id
    from public.jugadores where jugador_id ~ '^J[0-9]+$';
  insert into public.jugadores (jugador_id, apellido, nombre, division)
  values (v_id, trim(p_apellido), nullif(trim(coalesce(p_nombre, '')), ''), p_division);
  return v_id;
end;
$$;

-- Guarda Primera y Reserva de un partido en una sola transacción.
-- payload: { torneo_id, fase, fecha_nro, serie, zona, rival_id, condicion ('L'/'V'), fecha, cancha,
--            fuente_url, observaciones, publicado, prueba,
--            categorias: [ { categoria, partido_id?, hora, arbitro, estado?, gf, gc, penales_favor, penales_contra,
--                            goles: [ { lado ('propio'/'rival'), jugador_id, nombre, minuto, tiempo, tipo } ],
--                            incidencias: [ { lado, jugador_id, nombre, tipo, minuto, descripcion } ] } ] }
-- Si gf y gc vienen vacíos, el partido queda Programado (sirve para editar la programación).
create or replace function guardar_partido(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_propio   text;
  v_rival    text := payload ->> 'rival_id';
  v_local    boolean := coalesce(payload ->> 'condicion', 'L') = 'L';
  v_torneo   text := payload ->> 'torneo_id';
  v_fase     text := coalesce(payload ->> 'fase', 'Regular');
  v_fecha_nro int := (payload ->> 'fecha_nro')::int;
  v_serie    text := nullif(payload ->> 'serie', '');
  v_publicado boolean := coalesce((payload ->> 'publicado')::boolean, true);
  v_fuente   text;
  v_url      text := nullif(trim(coalesce(payload ->> 'fuente_url', '')), '');
  v_cat      jsonb;
  v_id       text;
  v_gf       int;
  v_gc       int;
  v_estado   text;
  v_completitud text;
  v_ids      text[] := '{}';
  v_nuevos   jsonb;
  v_actuales jsonb;
  v_propios_cargados int;
  v_inf      text;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if coalesce((payload ->> 'prueba')::boolean, false) then
    perform set_config('cdm.prueba', 'si', true);
  end if;

  select equipo_id into v_propio from public.equipos where es_propio;
  if v_propio is null or v_rival is null or v_torneo is null then
    raise exception 'faltan datos del partido' using errcode = '22023';
  end if;
  if v_fase = 'Regular' and v_fecha_nro is null then
    raise exception 'falta la fecha' using errcode = '22023';
  end if;

  -- Fuente: se reutiliza si el link ya existe; si no, se crea.
  if v_url is not null then
    select fuente_id into v_fuente from public.fuentes where url = v_url limit 1;
    if v_fuente is null then
      v_fuente := 'APP' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
      insert into public.fuentes (fuente_id, medio, fecha_publicacion, que_cubre, url)
      values (
        v_fuente,
        case
          when v_url ilike '%instagram.com%' then 'Instagram'
          when v_url ilike '%anyulin%' then 'Anyulin'
          when v_url ilike '%ellitoral%' then 'El Litoral'
          when v_url ilike '%ligasanmartin%' then 'Liga San Martín'
          else coalesce(substring(v_url from '^[a-z]+://(?:www\.)?([^/]+)'), 'Web')
        end,
        current_date,
        (select nombre from public.torneos where torneo_id = v_torneo) || ' · ' ||
          case when v_fase = 'Regular' then 'Fecha ' || v_fecha_nro else v_fase || coalesce(' ' || v_serie, '') end,
        v_url
      );
    end if;
  end if;

  for v_cat in select * from jsonb_array_elements(coalesce(payload -> 'categorias', '[]'::jsonb)) loop
    v_id := coalesce(nullif(v_cat ->> 'partido_id', ''),
      v_torneo || '-' || public.codigo_instancia(v_fase, v_fecha_nro, v_serie) || '-' ||
      case v_cat ->> 'categoria' when 'Reserva' then 'R' else 'P' end);
    v_gf := (v_cat ->> 'gf')::int;
    v_gc := (v_cat ->> 'gc')::int;
    if (v_gf is null) <> (v_gc is null) then
      raise exception 'marcador incompleto' using errcode = '22023';
    end if;
    v_estado := coalesce(nullif(v_cat ->> 'estado', ''), case when v_gf is null then 'Programado' else 'Jugado' end);
    -- Resultado sin marcador (G/E/P), solo si no hay marcador
    v_inf := case when v_gf is null then nullif(v_cat ->> 'resultado_informado', '') end;

    insert into public.partidos as p (
      partido_id, torneo_id, fase, zona, serie, fecha_nro, fecha, hora, categoria, local_id, visitante_id,
      goles_local, goles_visitante, penales_local, penales_visitante, resultado_informado, cancha, arbitro, estado, completitud,
      fuente_ids, observaciones, publicado)
    values (
      v_id, v_torneo, v_fase, nullif(payload ->> 'zona', ''), v_serie, v_fecha_nro,
      nullif(payload ->> 'fecha', '')::date, nullif(v_cat ->> 'hora', '')::time, v_cat ->> 'categoria',
      case when v_local then v_propio else v_rival end, case when v_local then v_rival else v_propio end,
      case when v_local then v_gf else v_gc end, case when v_local then v_gc else v_gf end,
      case when v_local then (v_cat ->> 'penales_favor')::int else (v_cat ->> 'penales_contra')::int end,
      case when v_local then (v_cat ->> 'penales_contra')::int else (v_cat ->> 'penales_favor')::int end,
      v_inf,
      nullif(payload ->> 'cancha', ''), nullif(v_cat ->> 'arbitro', ''), v_estado, 'Sin dato',
      case when v_fuente is null then '{}' else array[v_fuente] end,
      nullif(payload ->> 'observaciones', ''), v_publicado)
    on conflict (partido_id) do update set
      torneo_id = excluded.torneo_id, fase = excluded.fase, zona = coalesce(excluded.zona, p.zona),
      serie = excluded.serie, fecha_nro = excluded.fecha_nro, fecha = excluded.fecha, hora = excluded.hora,
      categoria = excluded.categoria, local_id = excluded.local_id, visitante_id = excluded.visitante_id,
      goles_local = excluded.goles_local, goles_visitante = excluded.goles_visitante,
      penales_local = excluded.penales_local, penales_visitante = excluded.penales_visitante,
      resultado_informado = excluded.resultado_informado, cancha = excluded.cancha, arbitro = excluded.arbitro, estado = excluded.estado,
      fuente_ids = case when v_fuente is null or v_fuente = any(p.fuente_ids) then p.fuente_ids
                        else p.fuente_ids || v_fuente end,
      observaciones = excluded.observaciones, publicado = excluded.publicado;

    -- Goles: se reemplazan solo si cambiaron (así la auditoría no registra cambios falsos).
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_nuevos from (
      select jsonb_build_object(
        'equipo_id', case when g ->> 'lado' = 'rival' then v_rival else v_propio end,
        'jugador_id', case when g ->> 'lado' = 'rival' or g ->> 'tipo' = 'En contra' then null else nullif(g ->> 'jugador_id', '') end,
        'nombre_en_fuente', case when g ->> 'tipo' = 'En contra' and g ->> 'lado' <> 'rival' and coalesce(g ->> 'nombre', '') = ''
                                 then 'En contra' else nullif(trim(coalesce(g ->> 'nombre', '')), '') end,
        'minuto', (g ->> 'minuto')::int,
        'tiempo', nullif(g ->> 'tiempo', ''),
        'tipo', coalesce(nullif(g ->> 'tipo', ''), 'Sin dato')) as x
      from jsonb_array_elements(coalesce(v_cat -> 'goles', '[]'::jsonb)) g
    ) s;
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_actuales from (
      select jsonb_build_object('equipo_id', equipo_id, 'jugador_id', jugador_id, 'nombre_en_fuente', nombre_en_fuente,
        'minuto', minuto, 'tiempo', tiempo, 'tipo', tipo) as x
      from public.goles where partido_id = v_id
    ) s;
    if v_nuevos <> v_actuales then
      delete from public.goles where partido_id = v_id;
      insert into public.goles (partido_id, equipo_id, jugador_id, nombre_en_fuente, minuto, tiempo, tipo)
      select v_id, x ->> 'equipo_id', x ->> 'jugador_id', x ->> 'nombre_en_fuente', (x ->> 'minuto')::int,
             x ->> 'tiempo', x ->> 'tipo'
      from jsonb_array_elements(v_nuevos) x;
    end if;

    -- Incidencias: igual que los goles.
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_nuevos from (
      select jsonb_build_object(
        'equipo_id', case i ->> 'lado' when 'rival' then v_rival when 'partido' then null else v_propio end,
        'jugador_id', case when i ->> 'lado' = 'propio' then nullif(i ->> 'jugador_id', '') end,
        'nombre_en_fuente', nullif(trim(coalesce(i ->> 'nombre', '')), ''),
        'tipo', i ->> 'tipo',
        'minuto', (i ->> 'minuto')::int,
        'descripcion', nullif(trim(coalesce(i ->> 'descripcion', '')), '')) as x
      from jsonb_array_elements(coalesce(v_cat -> 'incidencias', '[]'::jsonb)) i
    ) s;
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_actuales from (
      select jsonb_build_object('equipo_id', equipo_id, 'jugador_id', jugador_id, 'nombre_en_fuente', nombre_en_fuente,
        'tipo', tipo, 'minuto', minuto, 'descripcion', descripcion) as x
      from public.incidencias where partido_id = v_id
    ) s;
    if v_nuevos <> v_actuales then
      delete from public.incidencias where partido_id = v_id;
      insert into public.incidencias (partido_id, equipo_id, jugador_id, nombre_en_fuente, tipo, minuto, descripcion)
      select v_id, x ->> 'equipo_id', x ->> 'jugador_id', x ->> 'nombre_en_fuente', x ->> 'tipo',
             (x ->> 'minuto')::int, x ->> 'descripcion'
      from jsonb_array_elements(v_nuevos) x;
    end if;

    -- Completitud: Resultado / Con goles (todos los goles propios con autor) / Completo (además formación).
    select count(*) into v_propios_cargados from public.goles
      where partido_id = v_id and equipo_id = v_propio and (jugador_id is not null or tipo = 'En contra');
    v_completitud := case
      when v_gf is null and v_inf is not null then 'Inferido'
      when v_gf is null then 'Sin dato'
      when v_propios_cargados < v_gf then 'Resultado'
      when exists (select 1 from public.formaciones where partido_id = v_id) then 'Completo'
      else 'Con goles'
    end;
    update public.partidos set completitud = v_completitud where partido_id = v_id and completitud is distinct from v_completitud;

    v_ids := v_ids || v_id;
  end loop;

  return jsonb_build_object('partido_ids', to_jsonb(v_ids));
end;
$$;

-- Borra partidos en borrador que nunca se publicaron (por ejemplo, una prueba).
-- Un partido del fixture que se guardó como borrador no se puede borrar: estuvo publicado.
create or replace function borrar_borrador(p_partido_ids text[], p_prueba boolean default false)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_borrados int;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_prueba then
    perform set_config('cdm.prueba', 'si', true);
  end if;
  delete from public.partidos p
  where p.partido_id = any(p_partido_ids)
    and not p.publicado
    and not exists (
      select 1 from public.auditoria a
      where a.tabla = 'partidos' and a.registro = p.partido_id
        and ((a.antes ->> 'publicado')::boolean or (a.despues ->> 'publicado')::boolean));
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

-- Nadie sin sesión puede ejecutar las funciones de carga.
revoke execute on function crear_jugador(text, text, text) from public, anon;
revoke execute on function guardar_partido(jsonb) from public, anon;
revoke execute on function borrar_borrador(text[], boolean) from public, anon;
revoke execute on function registrar_cambio() from public, anon;
grant execute on function crear_jugador(text, text, text) to authenticated;
grant execute on function guardar_partido(jsonb) to authenticated;
grant execute on function borrar_borrador(text[], boolean) to authenticated;
grant execute on function codigo_instancia(text, int, text) to anon, authenticated;
