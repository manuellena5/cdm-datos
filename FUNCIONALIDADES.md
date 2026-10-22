# Funcionalidades

Registro de lo que hace la app. Se actualiza con cada funcionalidad nueva o cambiada.

## v0.2.0 — Fase 1 (esquema de la base)
- **App conectada a Supabase:** el pie muestra "Conectado".
- **Tablas** (`sql/01_esquema.sql`): fuentes, torneos, equipos, jugadores, partidos, goles (de los dos equipos), incidencias, formaciones, sanciones, posiciones y goleadores de la Liga. IDs iguales a los del Excel. Listas controladas (fase, estado, completitud, tipo de gol, tipo de incidencia…). Un solo club propio (`equipos.es_propio`). Cada tabla guarda sus fuentes como lista (`fuente_ids`).
- **Vistas** (`sql/02_vistas.sql`), todo desde el punto de vista del club propio:
  - `v_partidos`: condición L/V, rival, GF/GC, penales a favor/en contra, resultado G/E/P (un partido programado o postergado no tiene resultado; uno suspendido con marcador sí), goles propios en una línea ("Ruiz Díaz G. ×2, en contra"), goles del rival y rojas.
  - `v_campanas`: PJ, G, E, P, GF, GC, DG y Pts de la fase regular (con zonas e interzonales), programados, goles en contra a favor, hasta qué instancia de playoff llegó y última posición conocida.
  - `v_goleadores`: goles por jugador, torneo y categoría, sin contar goles en contra.
  - `v_historial_rival`: por rival y categoría, por año y total (año vacío), con % de puntos. Incluye todas las fases.
  - `v_faltantes`: sin árbitro, sin formación, goles propios sin jugador, goles del rival sin autor, programados vencidos, partidos cuyos goles cargados no coinciden con el marcador y fuentes citadas que no existen.
  - `v_disciplina`: rojas, dobles amarillas y expulsiones del DT por jugador, torneo y categoría.
- **Permisos** (`sql/03_permisos.sql`): lectura pública; sin sesión no se ven los partidos en borrador (`publicado = false`) ni sus goles, incidencias o formación. Nadie puede escribir todavía.

## v0.1.0 — Fase 0 (base)
- **Estructura de la app:** una sola página (`index.html`), sin frameworks, que abre con doble clic o desde GitHub Pages.
- **Encabezado:** escudo del club, nombre y navegación (Resultados, Goleadores, Historial, "Planteles · pronto").
- **Celular (hasta 720 px):** el menú pasa abajo, fijo, con Resultados, Goleadores e Historial.
- **Navegación por hash:** `#/resultados`, `#/partido/:id`, `#/goleadores`, `#/historial`, `#/admin`. Funcionan atrás/adelante del navegador; una dirección desconocida lleva a Resultados. Los filtros van a viajar en la URL (`?anio=…&torneo=…&cat=…`).
- **Pantallas:** todas muestran un recuadro "Pronto" hasta la Fase 3 (consulta) y la Fase 4 (administración).
- **Pie:** versión de la app, estado de la conexión con la base ("Conectado", "Todavía no hay base conectada." o "Sin conexión con la base. Probá de nuevo en un rato.") y link discreto "Administrar".
- **Helpers:** `plural()`, fechas cortas/largas, etiqueta de resultado G/E/P.
