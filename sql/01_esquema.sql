-- =====================================================================
-- 01_esquema.sql — Tablas del historial de partidos del Club Deportivo Mitre
-- Correr en el SQL Editor de Supabase, antes de 02_vistas.sql y 03_permisos.sql.
-- Se puede volver a correr: no borra datos ni falla si las tablas ya existen.
-- Los IDs de texto son los mismos del Excel Historial_Partidos_Mitre.xlsx.
-- =====================================================================

-- ---------- Fuentes (notas, placas, boletines) ----------
create table if not exists fuentes (
  fuente_id          text primary key,
  medio              text not null,
  fecha_publicacion  date,
  que_cubre          text,
  url                text
);

-- ---------- Torneos ----------
create table if not exists torneos (
  torneo_id     text primary key,                       -- '2026C'
  anio          int  not null check (anio between 1900 and 2100),
  nombre        text not null,                          -- 'Clausura 2026'
  competicion   text not null default 'Liga San Martín',-- o el nombre de la copa
  tipo          text not null default 'Liga'
                constraint torneos_tipo_chk check (tipo in ('Liga', 'Copa')),
  organizador   text,
  formato       text,
  campeon       text,
  notas         text,
  orden         int,                                    -- para ordenar dentro del año
  fuente_ids    text[] not null default '{}'
);

-- ---------- Equipos ----------
create table if not exists equipos (
  equipo_id     text primary key,                       -- 'MIT'
  nombre        text not null,
  nombre_corto  text not null,
  localidad     text,
  cancha        text,
  es_propio     boolean not null default false,
  notas         text
);
-- Un solo club propio.
create unique index if not exists equipos_un_solo_propio on equipos (es_propio) where es_propio;

-- ---------- Jugadores (solo del club propio) ----------
create table if not exists jugadores (
  jugador_id  text primary key,                         -- 'J001'
  apellido    text not null,
  nombre      text,
  apodo       text,
  posicion    text,
  division    text constraint jugadores_division_chk check (division in ('Primera', 'Reserva', 'Ambas')),
  fuente_ids  text[] not null default '{}',
  notas       text
);

-- ---------- Partidos ----------
create table if not exists partidos (
  partido_id           text primary key,                -- '2026C-F07-P'
  torneo_id            text not null references torneos (torneo_id) on update cascade,
  fase                 text not null default 'Regular'
                       constraint partidos_fase_chk check (fase in (
                         'Regular', 'Zona', 'Interzonal', 'Grupos', '32avos', '16avos',
                         'Octavos', 'Cuartos', 'Semifinal', 'Final')),
  zona                 text,                            -- 'B', 'Interzonal'…
  serie                text constraint partidos_serie_chk check (serie in ('Ida', 'Vuelta')),
  fecha_nro            int  check (fecha_nro > 0),
  fecha                date,
  hora                 time,                            -- para los programados
  categoria            text not null
                       constraint partidos_categoria_chk check (categoria in ('Primera', 'Reserva')),
  local_id             text not null references equipos (equipo_id) on update cascade,
  visitante_id         text not null references equipos (equipo_id) on update cascade,
  goles_local          int  check (goles_local >= 0),
  goles_visitante      int  check (goles_visitante >= 0),
  penales_local        int  check (penales_local >= 0),
  penales_visitante    int  check (penales_visitante >= 0),
  resultado_informado  text constraint partidos_resultado_informado_chk check (resultado_informado in ('G', 'E', 'P')),
  cancha               text,
  arbitro              text,
  estado               text not null default 'Jugado'
                       constraint partidos_estado_chk check (estado in (
                         'Jugado', 'Programado', 'Suspendido', 'Postergado', 'Ganado por mesa', 'Sin dato')),
  completitud          text not null default 'Resultado'
                       constraint partidos_completitud_chk check (completitud in (
                         'Sin dato', 'Inferido', 'Resultado', 'Con goles', 'Completo')),
  fuente_ids           text[] not null default '{}',
  observaciones        text,
  publicado            boolean not null default true,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  constraint partidos_equipos_distintos_chk check (local_id <> visitante_id),
  constraint partidos_marcador_completo_chk check ((goles_local is null) = (goles_visitante is null)),
  constraint partidos_penales_completos_chk check ((penales_local is null) = (penales_visitante is null))
);
create index if not exists partidos_torneo_idx on partidos (torneo_id, categoria, fecha_nro);
create index if not exists partidos_local_idx on partidos (local_id);
create index if not exists partidos_visitante_idx on partidos (visitante_id);

-- actualizado_en se mantiene solo.
create or replace function poner_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists partidos_actualizado_en on partidos;
create trigger partidos_actualizado_en
  before update on partidos
  for each row execute function poner_actualizado_en();

-- ---------- Goles (de los dos equipos) ----------
create table if not exists goles (
  gol_id            text primary key default ('G' || replace(gen_random_uuid()::text, '-', '')),
  partido_id        text not null references partidos (partido_id) on update cascade on delete cascade,
  equipo_id         text not null references equipos (equipo_id) on update cascade, -- a quién se le suma
  jugador_id        text references jugadores (jugador_id) on update cascade,       -- solo del club propio
  nombre_en_fuente  text,
  minuto            int  check (minuto between 0 and 150),
  tiempo            text constraint goles_tiempo_chk check (tiempo in ('1T', '2T', 'Suplementario', 'Sin dato')),
  tipo              text not null default 'Sin dato'
                    constraint goles_tipo_chk check (tipo in ('Jugada', 'Penal', 'Tiro libre', 'En contra', 'Sin dato')),
  observaciones     text
);
create index if not exists goles_partido_idx on goles (partido_id);
create index if not exists goles_jugador_idx on goles (jugador_id);

-- ---------- Incidencias (rojas, penales errados, etc.) ----------
create table if not exists incidencias (
  id                bigint generated by default as identity primary key,
  partido_id        text not null references partidos (partido_id) on update cascade on delete cascade,
  equipo_id         text references equipos (equipo_id) on update cascade,
  jugador_id        text references jugadores (jugador_id) on update cascade,
  nombre_en_fuente  text,
  tipo              text not null
                    constraint incidencias_tipo_chk check (tipo in (
                      'Roja', 'Doble amarilla', 'Amarilla', 'Penal errado', 'Penal atajado',
                      'Expulsión del DT', 'Lesión', 'Partido suspendido', 'Otra')),
  minuto            int  check (minuto between 0 and 150),
  tiempo            text constraint incidencias_tiempo_chk check (tiempo in ('1T', '2T', 'Suplementario', 'Sin dato')),
  descripcion       text
);
create index if not exists incidencias_partido_idx on incidencias (partido_id);

-- ---------- Formaciones ----------
create table if not exists formaciones (
  partido_id     text not null references partidos (partido_id) on update cascade on delete cascade,
  jugador_id     text not null references jugadores (jugador_id) on update cascade,
  rol            text not null
                 constraint formaciones_rol_chk check (rol in ('Titular', 'Suplente que entró', 'Suplente sin jugar')),
  camiseta       int  check (camiseta between 0 and 99),
  minuto_entra   int  check (minuto_entra between 0 and 150),
  minuto_sale    int  check (minuto_sale between 0 and 150),
  capitan        boolean not null default false,
  observaciones  text,
  primary key (partido_id, jugador_id)
);

-- ---------- Sanciones (Tribunal de Penas) ----------
create table if not exists sanciones (
  id                 bigint generated by default as identity primary key,
  jugador_id         text references jugadores (jugador_id) on update cascade,
  nombre_en_fuente   text,
  torneo_id          text references torneos (torneo_id) on update cascade,
  fecha_resolucion   date,
  fechas_suspension  int check (fechas_suspension >= 0),
  motivo             text,
  boletin_nro        text,
  fuente_ids         text[] not null default '{}'
);

-- ---------- Posiciones (tabla publicada tras cada fecha) ----------
create table if not exists posiciones (
  id             bigint generated by default as identity primary key,
  torneo_id      text not null references torneos (torneo_id) on update cascade,
  categoria      text not null
                 constraint posiciones_categoria_chk check (categoria in ('Primera', 'Reserva')),
  tras_fecha     int  not null check (tras_fecha > 0),
  posicion       int  check (posicion > 0),
  pts            int,
  pj             int  check (pj >= 0),
  g              int  check (g >= 0),
  e              int  check (e >= 0),
  p              int  check (p >= 0),
  dg             int,
  fuente_ids     text[] not null default '{}',
  observaciones  text,
  constraint posiciones_unica unique (torneo_id, categoria, tras_fecha)
);

-- ---------- Goleadores según la Liga (boletín COMET) ----------
create table if not exists goleadores_liga (
  id                 bigint generated by default as identity primary key,
  torneo_id          text not null references torneos (torneo_id) on update cascade,
  categoria          text not null
                     constraint goleadores_liga_categoria_chk check (categoria in ('Primera', 'Reserva')),
  jugador_id         text references jugadores (jugador_id) on update cascade,
  nombre_en_boletin  text not null,
  goles              int  not null check (goles >= 0),
  puesto             int  check (puesto > 0),
  actualizado        date,
  fuente_ids         text[] not null default '{}',
  constraint goleadores_liga_unica unique (torneo_id, categoria, nombre_en_boletin)
);
