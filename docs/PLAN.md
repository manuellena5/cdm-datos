# Historial de partidos — Club Deportivo Mitre
Plan de desarrollo por fases para trabajar con Claude Code.

> Cómo usar este documento: pedile a Claude Code **una fase por vez** ("Hacé la Fase 1 de docs/PLAN.md").
> Cada fase tiene alcance, entregables y criterios de aceptación. No avanzar a la siguiente sin cerrar los criterios de la anterior.
> **Estado (26/10/2026):** Fases 0 a 6.5 hechas. Sigue la **Fase 6.6**; después, la 7.

---

## 0. Contexto y decisiones tomadas

**Qué es:** una web para consultar el historial de partidos **oficiales** de Primera y Reserva del Club Deportivo Mitre (Landeta) y, más adelante, cargar los partidos nuevos. Partidos oficiales son los de la Liga Departamental San Martín y las copas en las que participó el club (por ejemplo, la copa de la Federación de años anteriores). Los amistosos no se cargan.

**Usuario:** por ahora solo M. No se difunde públicamente. Roles, usuarios y seguridad fina van en fases posteriores (Fase 7).

| Tema | Decisión |
|---|---|
| Base de datos | **Supabase** (Postgres, plan gratis) |
| Frontend | HTML + CSS + JavaScript sin frameworks, igual que las otras apps del club |
| Hosting | **GitHub Pages** |
| Dato maestro | **La base**. El Excel `Historial_Partidos_Mitre.xlsx` se importa una vez (Fase 2) y después se carga todo desde la app. El Excel se puede regenerar con una exportación |
| Diseño | Los mockups aprobados están en `docs/mockups/` (8 pantallas). Se usan como referencia visual, no como código a copiar. El escudo real está en `assets/escudo.png` (512 px, fondo transparente) y `assets/escudo-192.png`, y reemplaza al círculo "CDM" de los mockups |
| Repo | `cdm-datos` |

**Por qué Supabase:** las pantallas son casi todas sumarizaciones (goleadores, campañas, historial contra rivales). Eso en SQL son vistas simples y rápidas. Además deja el camino listo para usuarios (Fase 7), para el sistema del club y para el datawarehouse que está en carpeta.

**Datos de partida:** `C:\Users\manuel.ellena\Documents\Drive\Club - Futbol Mayor\Gestion Club\Historial_Partidos_Mitre.xlsx`. Hojas: Partidos, Goles, Jugadores, Equipos, Torneos, Posiciones, Goleadores_Liga, Fuentes, Formaciones, Tarjetas, Sanciones (las tres últimas vacías). 2026 completo hasta Clausura F11. 2024 y 2025 con algunos partidos sueltos. **Actualización oct-2026:** el Excel ya tiene 2010–2026 y se importa por última vez en la Fase 4.5.2; desde ahí la base es el único dato maestro.

---

## Convenciones para todo el proyecto (copiar a CLAUDE.md)

- **Idioma:** todo lo visible en español rioplatense, mensajes cortos y en presente.
- **Nada de internals en pantalla:** no mostrar IDs (`2026C-F07-P`, `J001`, `MIT`), nombres de tablas, URLs de Supabase ni mensajes técnicos. Los IDs existen y vinculan, pero son invisibles.
- **Errores en términos del usuario:** "Sin conexión. Estás viendo los últimos datos guardados." y no "fetch failed".
- **Plurales:** helper `plural(n, 'gol', 'goles')`. Nunca "gol(es)".
- **El club propio no se hardcodea:** se toma de `equipos.es_propio = true`.
- **Versión:** constante `APP_VERSION` visible en un pie discreto. Si hay service worker, se sube su versión de cache en el mismo cambio.
- **Git:** no commitear ni pushear sin que M lo pida.
- **Verificar en el navegador** antes de dar algo por terminado, y contar qué se probó.
- **Cada cambio al modelo de datos:** explicar primero qué se rompería y después hacerlo.
- **Secretos:** la `service_role key` de Supabase nunca va al repo. Solo la `anon key` puede estar en el frontend.

### Diseño (de los mockups)
- Colores: azul club `#062F5A` (el del escudo; los mockups usan `#14284B`, se reemplaza), fondo `#F2F4F8`, tarjetas `#FFFFFF`, texto `#1A2233`, texto secundario `#4A5468`, borde `#C7CEDB` / `#DDE2EA`, acento `#2D5BA3`.
- Etiqueta de resultado: **G** fondo `#062F5A` y texto blanco · **E** fondo `#E3E7EE` y texto `#2F3A4D` · **P** fondo `#FCE3D2` y texto `#8A3B0F`. Siempre con la letra, nunca solo color.
- Escudo: en el encabezado (44 px en PC, 36 px en celular), en la pantalla de ingreso (72 px) y como favicon / ícono.
- Tipografía: **Barlow Condensed** 600/700 para títulos y números, **Barlow** 400–700 para texto (Google Fonts).
- Botones y controles de 44 px de alto como mínimo. Funciona a 390 px de ancho (celular) y hasta 1120 px de contenido en PC.

---

## Fase 0 — Preparación

**Alcance**
1. Crear el repo `cdm-datos` en GitHub y el proyecto en Supabase.
2. Estructura:
   ```
   cdm-datos/
   ├── index.html          ← app (consulta + admin)
   ├── css/app.css
   ├── assets/escudo.png, escudo-192.png
   ├── js/
   │   ├── config.js       ← SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION
   │   ├── api.js          ← todas las llamadas a Supabase
   │   ├── ui.js           ← helpers (plural, fechas, chips)
   │   └── pantallas/      ← resultados.js, detalle.js, goleadores.js, historial.js, admin*.js
   ├── sql/                ← 01_esquema.sql, 02_vistas.sql, 03_funciones.sql…
   ├── scripts/importar_excel.py
   ├── docs/PLAN.md, docs/mockups/
   ├── CLAUDE.md
   └── FUNCIONALIDADES.md  ← registro de funcionalidades, se actualiza en cada cambio
   ```
3. Cliente Supabase JS cargado por CDN (`@supabase/supabase-js@2`, versión exacta fijada).
4. Enrutado simple por hash (`#/resultados`, `#/partido/:id`, `#/goleadores`, `#/historial`, `#/admin`).

**Criterios de aceptación**
- `index.html` abre en local y en GitHub Pages y muestra "Conectado" o un mensaje claro si Supabase no responde.
- `CLAUDE.md` contiene las convenciones de arriba.

---

## Fase 1 — Esquema de la base

**Tablas** (los IDs de texto se mantienen iguales a los del Excel para que la importación sea directa):

| Tabla | Clave | Campos principales |
|---|---|---|
| `torneos` | `torneo_id` (`2026C`) | anio, nombre, **competicion** ("Liga San Martín", nombre de la copa), **tipo** (Liga / Copa), organizador, formato, campeon, notas, orden |
| `equipos` | `equipo_id` (`MIT`) | nombre, nombre_corto, localidad, cancha, **es_propio** bool, notas |
| `jugadores` | `jugador_id` (`J001`) | apellido, nombre, apodo, posicion, division, notas |
| `partidos` | `partido_id` (`2026C-F07-P`) | torneo_id, fase (Regular/Zona/Interzonal/Grupos/32avos/16avos/Octavos/Cuartos/Semifinal/Final), zona (para los torneos por zonas), serie ("Ida"/"Vuelta" en llaves de dos partidos), fecha_nro, fecha, categoria (Primera/Reserva), local_id, visitante_id, goles_local, goles_visitante, penales_local, penales_visitante, resultado_informado (G/E/P, solo sin marcador), cancha, arbitro, estado (Jugado/Programado/Suspendido/Postergado/Ganado por mesa/Sin dato), completitud, fuentes, observaciones, **publicado** bool (default true), creado_en, actualizado_en |
| `goles` | `gol_id` | partido_id, equipo_id (a quién se le suma), jugador_id (solo los del club propio), nombre_en_fuente, minuto, tiempo (1T/2T/Supl.), tipo (Jugada/Penal/Tiro libre/En contra) |
| `incidencias` | id | partido_id, equipo_id, jugador_id (si es del club propio), nombre_en_fuente, **tipo** (Roja / Doble amarilla / Amarilla / Penal errado / Penal atajado / Expulsión del DT / Lesión / Partido suspendido / Otra), minuto, tiempo, descripcion. Reemplaza a la hoja vacía "Tarjetas" del Excel |
| `formaciones` | (partido_id, jugador_id) | rol (Titular/Suplente que entró/Suplente sin jugar), camiseta, minuto_entra, minuto_sale, capitan |
| `sanciones` | id | jugador_id, nombre_en_fuente, torneo_id, fecha_resolucion, fechas_suspension, motivo, boletin_nro, fuente |
| `posiciones` | id | torneo_id, categoria, tras_fecha, posicion, pts, pj, g, e, p, dg, fuente (fotos de la tabla publicada) |
| `goleadores_liga` | id | torneo_id, categoria, jugador_id, nombre_en_boletin, goles, puesto, actualizado, fuente (boletín oficial COMET) |
| `fuentes` | `fuente_id` | medio, fecha_publicacion, que_cubre, url |

Restricciones: FKs entre tablas, `check` en los campos de lista, `goles_local` y `goles_visitante` nulos o ≥ 0.

**Vistas** (toda la lógica de "desde el punto de vista de Mitre" vive acá, no en el frontend):
- `v_partidos`: cada partido con nombres de equipos, `condicion` (L/V), `rival_id`, `gf`, `gc`, `resultado` (G/E/P, usando el marcador o `resultado_informado`), `goles_mitre_texto` ("Ruiz Díaz G. ×2, Villarruel D."), `goles_rival_texto` y `tiene_rojas` (para marcar la tarjeta del partido).
- `v_campanas`: por torneo y categoría → PJ, G, E, P, GF, GC, DG, Pts (solo fase Regular, con columna aparte para el playoff: hasta dónde llegó).
- `v_goleadores`: por jugador, torneo y categoría → goles (sin contar "En contra"). Sumable por año.
- `v_historial_rival`: por rival y categoría → PJ, G, E, P, GF, GC, Pts, % de puntos.
- `v_faltantes`: conteos para el panel de admin (sin árbitro, sin formación, goles de Mitre sin jugador, goles del rival sin autor, partidos programados ya pasados sin resultado).
- `v_disciplina`: rojas y expulsiones por jugador, torneo y categoría.

**Permisos en esta fase:** RLS activado, con lectura pública (`select` para `anon`) en tablas y vistas. Escritura todavía no.

**Entregables:** `sql/01_esquema.sql`, `sql/02_vistas.sql`, que se pueden correr en el SQL Editor de Supabase en orden y volver a correr sin romper nada (`create … if not exists` / `create or replace view`).

**Criterios de aceptación**
- Los scripts corren sin errores en una base vacía.
- Con los datos de la Fase 2 cargados, las vistas devuelven las cifras de control (ver Fase 2).

---

## Fase 2 — Importación del Excel

**Alcance:** `scripts/importar_excel.py`, que lee `Historial_Partidos_Mitre.xlsx` y hace *upsert* en Supabase en el orden correcto (fuentes → torneos → equipos → jugadores → partidos → goles → incidencias → posiciones → goleadores_liga). La hoja "Tarjetas" del Excel, si tiene filas, va a `incidencias`.
- La `service_role key` se toma de una variable de entorno o de un `.env` que está en `.gitignore`.
- Modo `--dry-run`: valida y muestra conteos sin escribir.
- Ignora las columnas calculadas del Excel (las grises: local, visitante, condicion, GF, GC, resultado, etc.), que ahora calculan las vistas.
- Convierte vacíos en `null` y fechas a ISO.
- Marca `equipos.es_propio = true` para `MIT`.
- Se puede correr varias veces sin duplicar.

**Cifras de control** (tienen que dar igual en `v_campanas` y `v_goleadores`):

| Torneo | Categoría | PJ | G | E | P | GF | GC | Pts |
|---|---|---|---|---|---|---|---|---|
| Apertura 2026 (fase regular) | Primera | 13 | 2 | 7 | 4 | 9 | 10 | 13 |
| Apertura 2026 | Reserva | 13 | 5 | 4 | 4 | 19 | 17 | 19 |
| Clausura 2026 (11 fechas) | Primera | 11 | 5 | 1 | 5 | 14 | 16 | 16 |
| Clausura 2026 (11 fechas) | Reserva | 11 | 8 | 2 | 1 | 24 | 7 | 26 |

- Octavos Apertura 2026: General 2-2 Mitre, penales 5-3 para General.
- Goleador Primera 2026: Ruiz Díaz, Gabriel, 7 goles. Goleador Reserva 2026: Brisuela Gandolfo, Benjamín, 10 goles.

**Criterios de aceptación:** dry-run limpio, importación real sin errores, cifras de control OK.

---

## Fase 3 — Páginas de consulta (solo lectura)

Referencia visual: `docs/mockups/` pantallas 1 a 5.

### 3.1 Resultados (`#/resultados`) — mockups 1 y 3
- Filtros: **Año**, **Torneo** (Apertura / Clausura / copas de ese año / Todo el año) y **Categoría** (Primera / Reserva, botón segmentado). Por defecto: el torneo más reciente y Primera.
- Los filtros quedan en la URL (`#/resultados?anio=2026&torneo=C&cat=P`), así se puede compartir o volver.
- Franja de resumen: Pts, PJ, G, E, P, GF, GC (desde `v_campanas`).
- Una tarjeta por partido: fecha nro y día, local, marcador, visitante, etiqueta G/E/P, goles de Mitre en una línea y el link **Detalle**. El nombre del club propio en negrita. Si hubo rojas, un ícono pequeño de tarjeta roja con la cantidad.
- Los playoffs aparecen después de la fase regular, con su instancia ("Octavos") y los penales si hubo.
- Los partidos programados muestran la hora en lugar del marcador y una etiqueta punteada.
- En el celular: tarjeta compacta con los equipos uno arriba del otro (mockup 3) y menú inferior con Resultados, Goleadores e Historial.

### 3.2 Detalle del partido (`#/partido/:id`) — mockup 2
- Encabezado con equipos y marcador grande. Datos: día, estadio, árbitro y posición en la tabla después del partido (de `posiciones`, si hay).
- Goles de Primera y de Reserva del mismo partido, de los dos equipos (ambas categorías se vinculan por torneo y fecha), con tiempo o minuto si existe. Se muestran como en el mockup: los de Mitre de un lado y los del rival del otro.
- **Incidencias:** rojas, dobles amarillas, penales errados, etc., en orden de minuto, con un ícono por tipo.
- Formación: si no hay, recuadro vacío con "Todavía no hay formación cargada para este partido."
- Historial contra ese rival (PJ/G/E/P y lista de los últimos cruces) y link al historial completo.
- Fuentes con links.

### 3.3 Goleadores (`#/goleadores`) — mockup 4
- Filtros: Año (incluye "Todos") y Torneo.
- Tarjetas destacadas: máximo goleador de Primera y de Reserva.
- Dos tablas (Primera y Reserva): puesto, jugador, barra proporcional, goles en Apertura, goles en Clausura y total. Los goles en contra de rivales se informan como nota, no como jugador.

### 3.4 Historial (`#/historial`) — mockup 5
- Campañas por torneo: PJ, G, E, P, GF, GC, Pts y "cómo terminó". Cada fila lleva a Resultados con ese filtro.
- Datos destacados: mayor goleada a favor, peor derrota, rivales contra los que no perdió (en el período elegido).
- Contra cada rival: tabla con % de puntos. Filtro Período (año o todo el historial) y Categoría.

**Rendimiento:** se lee todo de las vistas. Se guarda en memoria lo ya pedido y en `localStorage` la última respuesta, para mostrar algo si no hay conexión ("Sin conexión. Estás viendo los últimos datos guardados.").

**Criterios de aceptación**
- Las cifras de la Fase 2 coinciden en pantalla.
- Se puede navegar de Resultados a Detalle, de Detalle al Historial y volver con el botón atrás del navegador.
- Se ve bien a 390 px y a 1280 px, sin scroll horizontal (las tablas anchas tienen scroll dentro de su recuadro).
- Ningún ID interno visible: una búsqueda en `innerText` de `/\b(J\d{3}|20\d\d[AC]-|MIT\b)/` en todas las pantallas no encuentra nada.

---

## Fase 4 — Modo administrador (carga de partidos)

Referencia visual: mockups 6, 7 y 8. Pensado para usar desde el celular en la cancha.

### 4.1 Acceso mínimo
Aunque roles y usuarios quedan para la Fase 7, **la escritura necesita aunque sea un usuario**. La `anon key` está en el código de la página y, sin esto, cualquiera que tenga el link podría modificar datos.
- Supabase Auth con **un solo usuario** (el de M), creado a mano en el panel de Supabase. Sin registro desde la app.
- Políticas RLS: `insert`/`update`/`delete` solo para `authenticated`. La lectura sigue pública.
- Pantalla de ingreso (mockup 6): usuario, clave con botón mostrar/ocultar, y "Volver al historial". La sesión queda recordada en el dispositivo.
- El acceso a admin es un link discreto en el pie ("Administrar"), no en el menú principal.

### 4.2 Panel (`#/admin`) — mockup 8
- **Para cargar:** partidos `Programado` del torneo actual ordenados por fecha. El próximo, resaltado, con el botón "Cargar resultado".
- **Últimos cargados:** fecha, partido, resultado de Primera y de Reserva, qué datos faltan, estado (Publicado/Borrador) y Editar.
- **Datos que faltan:** conteos de `v_faltantes`.
- **Registro de cambios:** últimos 10 de la tabla `auditoria` (ver 4.4).
- Botones "+ Partido fuera del fixture" (amistoso o copa), "Ver sitio público" y "Salir".

### 4.3 Cargar / editar partido (`#/admin/partido/:id`) — mockup 7
Una sola pantalla con secciones:
1. **Partido:** torneo y fecha/instancia. Al elegirlos se completan solos el rival, si Mitre es local o visitante y la cancha (desde la fila `Programado` o la cancha del local). Se pueden corregir.
2. **Primera** y 3. **Reserva:** marcador con botones − / + para Mitre y para el rival. Por cada gol de Mitre aparece una fila: jugador (lista de jugadores, con "+ Jugador nuevo…" que abre un mini formulario de apellido y nombre), minuto (opcional) y tipo (Jugada, Penal, Tiro libre, En contra). Por cada gol del rival, una fila más simple: nombre (texto libre con sugerencias de nombres ya usados para ese equipo) y minuto, ambos opcionales.
   - Si es playoff y hay empate, aparecen los campos de penales.
   - Cartel suave si la cantidad de filas no coincide con el marcador ("Faltan 1 goleador"). No impide guardar.
4. **Incidencias (opcional):** botón "+ Agregar incidencia": tipo, equipo, jugador (lista si es de Mitre, texto si es del rival), minuto y comentario.
5. **Extras (opcional):** árbitro, link de la fuente y observaciones.
- Botones **Guardar borrador** (`publicado = false`, no aparece en la consulta) y **Publicar**.
- `completitud` se calcula sola: Resultado / Con goles / Completo.

**Guardado atómico:** función SQL `guardar_partido(payload jsonb)` (`security invoker`) que en una transacción hace upsert de las filas Primera y Reserva del partido, reemplaza sus goles e incidencias y actualiza `actualizado_en`. El frontend hace una sola llamada `rpc`.

### 4.4 Auditoría
Tabla `auditoria` (fecha, usuario, tabla, registro, accion, antes jsonb, despues jsonb), llenada por triggers en `partidos`, `goles` e `incidencias`. En el panel se muestra en lenguaje simple: "Manuel publicó F11 vs San Martín".

**Criterios de aceptación**
- Sin iniciar sesión no se puede escribir. Probarlo con la `anon key` desde la consola del navegador.
- Cargar la F12 vs Trebolense de punta a punta desde el celular en menos de 2 minutos.
- Un borrador no aparece en la consulta. Al publicarlo, aparece y actualiza resumen, goleadores e historial.
- Editar un partido viejo deja registro en auditoría.

---

## Fase 4.5 — Cierre de la Fase 4, histórico completo y escudos

Hacer en este orden. Cada punto es una tarea separada para Claude Code ("Hacé el punto 4.5.2 de docs/PLAN.md").

### 4.5.1 Cerrar la Fase 4
Probar en el navegador (PC y celular a 390 px) y contar qué se probó:
- Sin sesión, desde la consola con la `anon key`: `insert` / `update` / `delete` en `partidos`, `goles` e `incidencias` tienen que fallar.
- Cargar un partido completo desde el celular en menos de 2 minutos: goles de los dos lados, una roja, y penales en un playoff empatado.
- Borrador → no se ve en la consulta. Publicar → se actualizan Resultados, Goleadores e Historial.
- Editar un partido viejo → aparece en "Registro de cambios".
- Completar lo que falte de la Fase 4 contra sus criterios de aceptación.

### 4.5.2 Importación final del Excel histórico
El Excel ahora tiene **2010 a 2026** (631 partidos, 652 goles): Copa Federación 2010 y Liga San Martín 2011–2026. La base hoy tiene solo 2021–2026.
- Correr `python scripts/importar_excel.py --dry-run` y revisar el plan antes de escribir. Datos nuevos que tiene que aceptar sin error:
  - Torneo `2010F` con `tipo = Copa` (la hoja Torneos ahora trae las columnas `tipo` y `competicion`) y partidos con `fase = Grupos` y zona.
  - Equipos nuevos: `AMC` (América de Cañada de Gómez), `UTO` (Unión FC de Totoras), `CSL` (Combate de San Lorenzo).
  - Partidos `Suspendido` con marcador (2015C, cuartos vs La Emilia), partidos `Inferido` sin marcador con `resultado_informado` (2010F vs Combate, 2021A F7, 2013C cuartos), finales de ida y vuelta de Reserva (2016C) y zonas con fecha libre (Clausura 2016).
  - Unos 120 jugadores nuevos (J090 en adelante).
- Si el importador frena por borradores o partidos que no están en el Excel, mostrar cuáles y preguntarle a M antes de usar `--forzar`.
- Después de importar: verificar las cifras de control, que Resultados, Historial y Goleadores muestren 2010–2026 bien, y que el Historial con "Todos los años" cargue rápido en el celular.
- **Desde acá la base es el único dato maestro.** El Excel queda congelado (M lo renombra a `Historial_Partidos_Mitre_congelado.xlsx`). El importador queda solo para `--dry-run`: si se vuelve a correr en serio, pisa las correcciones hechas en la base. Agregar un aviso en `scripts/README.md`.

### 4.5.3 Corregir jugadores y unir duplicados (`#/admin/jugadores`)
Hay muchos jugadores con inicial o solo apellido ("Díaz J.", "Fossarelli") y posibles duplicados entre años (por ejemplo `J111` "Rubiolo" y "Matías Rubiolo" de 2011–2014). La hoja Revisar del Excel tiene la lista.
- Lista de jugadores con buscador: apellido, nombre, años en que aparece, goles y partidos. Editar apellido, nombre, apodo y notas. El `jugador_id` no se toca.
- **Unir jugadores:** elegir el que queda y el que sobra. Sugerir duplicados por apellido parecido. Función SQL `unir_jugadores(queda, sobra)` en una transacción: pasa `goles`, `incidencias`, `sanciones` y `formaciones` al que queda (en `formaciones` la clave es `partido_id + jugador_id`: si los dos están en el mismo partido, avisar y no unir), junta las notas y borra el sobrante.
- Auditoría: sumar triggers en `jugadores` para que los cambios y uniones queden en "Registro de cambios".
- Normalizar: si `nombre` termina en punto (inicial), mostrarlo bien en las vistas (hoy queda "Díaz J..").

### 4.5.4 Escudos de los equipos
- Columna `escudo` (texto, ruta del archivo) en `equipos`. Archivos en `assets/escudos/<equipo_id>.png`, cuadrados, unos 128 px, fondo transparente. M consigue las imágenes de las redes oficiales de cada club.
- Mostrarlos en las tarjetas de Resultados (24 px), el Detalle del partido (48 px), la tabla de rivales del Historial y los selectores de la pantalla de carga.
- Sin escudo: círculo con las iniciales del nombre corto, en gris, del mismo tamaño. Nada se corre de lugar.
- En `#/admin/jugadores`, o en una pantalla chica de equipos, poder subir o cambiar el escudo (Supabase Storage, bucket público `escudos`), para no depender de un commit cada vez.

**Criterios de aceptación de la 4.5:** la base tiene 2010–2026 y coincide con las cifras del Excel; se puede corregir un jugador y unir dos sin perder goles; todos los equipos se ven con escudo o con sus iniciales.

---

## Fase 5 — Carga histórica

La búsqueda de datos 2010–2026 ya se hizo fuera de la app y entra con la 4.5.2. Lo que queda es completar huecos (ver la hoja Revisar del Excel, que se puede pasar a una tabla `pendientes` para verla en el panel de admin):
- Clausura 2012 (fecha 1 y de la 7 en adelante, salvo la 9), partidos sueltos de 2011, 2013C cuartos, 2014A F6, 2014C F5, 2016A F13.
- Goleadores faltantes, sobre todo 2013.
- Liga Independiente (antes de 2011) si aparecen fuentes.
- **Importador de lote** en admin (opcional, solo si aparece un torneo entero para cargar): pegar una tabla de texto o CSV, previsualizar, normalizar equipos contra `equipos` y crear los partidos con `completitud = Resultado`.

**Criterios de aceptación:** cada torneo cargado coincide con las tablas publicadas de esa temporada, cuando existan.

---

## Fase 6 — Plantel y estadísticas de jugadores

Hoy hay formaciones solo del Clausura 2023 y algunas de 2011–2013 escritas en las observaciones de los partidos. Por eso el orden va de lo que ya se puede mostrar a lo que necesita datos nuevos:
1. **Ficha de jugador** (`#/jugador/:id`) con lo que ya existe: goles por torneo y categoría, rojas, años en que aparece, partidos con formación cargada. Desde Goleadores y del Detalle del partido se llega a la ficha.
2. **Pasar las formaciones de las observaciones a la tabla `formaciones`** (2011C F9, 2012A F9, 2012C F6 y F9, 2013C F7), creando o vinculando jugadores con la herramienta de la 4.5.3.
3. **Carga de formación** en la pantalla de partido: titulares, suplentes que entraron con su minuto, capitán y amarillas por jugador.
4. **Planteles** (`#/planteles`): plantel por torneo y categoría, armado con formaciones y goleadores, con las estadísticas de cada uno (partidos, titularidades, minutos si están, goles y tarjetas). El ítem "Planteles · pronto" del menú pasa a estar activo.
5. Sanciones desde los boletines del Tribunal de Penas.

---

## Fase 6.5 — Herramientas de revisión en modo administrador

Referencia visual: mockups **9, 10 y 11** (`docs/mockups/AdminResultados.dc.html`, `AdminPlantel.dc.html` y `AdminDuplicados.dc.html`). Reemplaza la pantalla de planteles actual (`admin-planteles.js`) y la sección de posibles duplicados de `admin-jugadores.js`. Se usa lo que ya existe: `fechas_libres`, `torneos.fechas_regular`, `v_fechas_faltantes`, `planteles`, `unir_jugadores()` y la auditoría.

Hacer en este orden, un punto por vez ("Hacé el punto 6.5.1 de docs/PLAN.md").

### 6.5.0 Menú de administrador
- Barra fija en todas las pantallas de admin: **Panel · Resultados · Planteles · Jugadores** (más Equipos si ya existe), con la pantalla actual marcada. En el celular pasa a una fila con scroll horizontal.

### 6.5.1 Resultados en modo administrador (`#/admin/resultados`) — mockup 9
- Los mismos filtros que la consulta (año, torneo, categoría, guardados en la URL) y la misma tarjeta de partido, más un **lápiz** que abre `#/admin/partido/:id` con todo lo cargado (goles de los dos lados, incidencias, formación, árbitro, fuentes) para corregir o agregar.
- Incluye borradores (con su etiqueta) y todas las fases: regular, playoff, copas.
- **Todas las fechas de la fase regular, sin saltos**, de 1 a `fechas_regular` (o hasta la última cargada si está vacío; poder fijar la cantidad desde la misma pantalla). Cada fecha sin partido muestra una fila punteada en su lugar:
  - **Posible libre**: no hay partido, y la tabla (`posiciones`) o el conteo de fechas indica que Mitre no sumó o no jugó esa fecha. Es una sugerencia, no se guarda sola.
  - **Pendiente**: no hay partido ni indicios.
  - **Libre** / **No se jugó**: ya marcada en `fechas_libres`, con quién y cuándo, y "Deshacer".
  - Botones "Cargar partido" (abre la carga con torneo y fecha ya elegidos) y "Marcar libre".
- **Partidos con datos que faltan**: marca naranja al costado y etiquetas por cada faltante, tomadas de `v_faltantes` (goleadores de Mitre o del rival que no suman, sin árbitro, falta Reserva o Primera de esa fecha, resultado inferido, programado vencido). Las etiquetas informativas (fecha aproximada, con formación) van en gris o verde y no cuentan como faltantes. "Fecha aproximada" sale de las observaciones del importador; si conviene, agregar una columna `fecha_aproximada boolean` a `partidos` (avisar el impacto antes).
- Arriba, un **resumen del torneo**: fechas, partidos cargados, libres, fechas sin partido, partidos con faltantes, y Pts/PJ/G/E/P. Selector **"Todas las fechas / Solo lo que falta"**.
- Desde el Panel, el bloque "Datos que faltan" lleva a esta pantalla ya filtrada.

### 6.5.2 Plantel del torneo en tabla (`#/admin/planteles`) — mockup 10
- Filtros año, torneo y categoría. Una **tabla editable**, una fila por jugador: incluido (tilde), apellido, nombre, puesto, apodo (y camiseta si se usa), goles y rojas del torneo (solo lectura) y **"por qué está"** (goles, roja, formación, lista cargada, nuevo).
- Viene **precargada** con todos los jugadores que tienen algún dato en ese torneo y categoría (goles, incidencias, formaciones) más los que ya están en `planteles`. Destildar = sacarlo de la lista (no borra al jugador ni sus datos).
- Editar apellido o nombre en la tabla corrige al jugador (con aviso si el cambio afecta a otros torneos: "Este jugador aparece también en 2013 y 2015").
- Filas marcadas para revisar: sin nombre, o posible duplicado (link a 6.5.3 con ese par abierto).
- **"+ Agregar fila"**: al escribir el apellido sugiere jugadores existentes (sin acentos ni mayúsculas, mostrando los años en que aparecen) y ofrece "Crear jugador nuevo". Teclado: Enter pasa a la fila siguiente.
- **Sugeridos**: jugadores del torneo anterior de la misma categoría que no tienen datos en este, con "Sumar" y "Sumar los marcados".
- **"Copiar plantel de…"** otro torneo.
- **"Pegar lista o CSV"** (panel al costado): un jugador por línea, "apellido, nombre, puesto" o columnas copiadas de Excel. La previsualización dice por línea: ya está en el plantel, existe y se suma, parecido a otro (elegir cuál o crear nuevo), o nuevo. Nada se guarda hasta confirmar.
- Guardado automático por fila, con aviso discreto "Guardado". Todo pasa por la auditoría.

### 6.5.3 Posibles duplicados (`#/admin/jugadores/duplicados`) — mockup 11
- Tabla nueva **`jugadores_distintos`** (`jugador_a`, `jugador_b`, `motivo`, `creado_en`, `creado_por`; clave por el par ordenado) para guardar los pares descartados. Explicar el impacto antes: es una tabla nueva, no rompe nada; `unir_jugadores` tiene que borrar los pares del jugador que desaparece.
- Vista o función `v_posibles_duplicados`: pares con el mismo apellido normalizado (sin acentos, sin mayúsculas, y variantes de una letra como Fosarelli/Fossarelli), que no estén en `jugadores_distintos`. Por cada par: años de cada uno, cantidad de partidos con datos y **en cuántos partidos aparecen juntos** (goles, incidencias, formación o plantel del mismo partido/torneo). Si coinciden en algún partido, se marca "no pueden ser el mismo" y va al final.
- Pantalla con dos columnas:
  - Izquierda: pares **Pendientes** y **Descartados** (con "Volver a pendientes").
  - Derecha: los dos jugadores lado a lado (años, partidos, goles), el mensaje "Nunca aparecen en el mismo partido" o "Coinciden en N partidos", y una **tabla de los partidos donde aparece cada uno**, en orden de fecha, con qué dato tiene cada uno en ese partido (gol, penal, roja, titular…), "Ver partido" y **"Pasar el dato al otro"** (mueve ese gol, incidencia o fila de formación de un jugador al otro, sin unirlos).
  - Acciones: **Son el mismo** (elegir apellido y nombre final, usa `unir_jugadores`), **No son el mismo** (motivo opcional, guarda en `jugadores_distintos`), **Editar datos** de cada uno, y **Decidir después**.
- El contador "Posibles duplicados (N)" en el Panel y en Jugadores cuenta solo los pendientes.

### 6.5.4 Formación en 18 lugares (`#/admin/partido/:id`)
- En la carga del partido, la sección **Formación** pasa a ser una **tabla fija de 18 lugares** por categoría: 1 a 11 titulares, 12 a 18 suplentes. Se completa uno por uno; los lugares vacíos no se guardan. El número de lugar se guarda en `formaciones.nro_lista` (ya existe: no cambia el modelo).
- Cada lugar tiene un **selector de jugador que se puede escribir para buscar** (sin acentos ni mayúsculas): primero los del plantel de ese torneo y categoría, después el resto, y "+ Jugador nuevo". Al elegir pasa al lugar siguiente.
- Por fila: rol (titular fijo en 1–11; en 12–18 "No se sabe si entró" / "Entró" / "No entró"), minuto en que entró o salió, capitán y amarilla, como hoy.
- Las formaciones ya cargadas se acomodan por `nro_lista`; si no lo tienen, titulares primero y después el resto. "Copiar de…" el partido anterior llena los mismos lugares.
- Avisos que no impiden guardar: jugador repetido (sí impide), menos de 11 titulares.

**Criterios de aceptación de la 6.5**
- En Clausura 2011 Primera se ven las 14 fechas en orden, con F2, F5 y F8 sin partido; marcar F8 como libre la saca de pendientes en el Panel y "Deshacer" la vuelve a poner.
- Desde el lápiz se corrige un goleador de un partido de 2014 y el cambio aparece en Resultados, Goleadores y la ficha del jugador.
- El plantel de Apertura 2014 Primera aparece precargado con los jugadores que tienen goles o rojas ese torneo; se agrega uno con "+ Agregar fila", otro con "Pegar lista", y uno de los sugeridos.
- Un par descartado no vuelve a aparecer; uno unido deja todos los goles en el que queda; "Pasar el dato al otro" mueve un solo gol.
- Todo funciona a 390 px de ancho.

---

## Fase 6.6 — Cuerpo técnico e historial contra cada rival

Referencia visual: mockup **10** (bloque "Cuerpo técnico" en `docs/mockups/AdminPlantel.dc.html`) mockup **12** (`docs/mockups/HistorialRival.dc.html`) y mockups **13 a 16** (celular). Un punto por vez ("Hacé el punto 6.6.1 de docs/PLAN.md").

### 6.6.1 Cuerpo técnico de cada plantel
- Por torneo y categoría: **un técnico** y **hasta 3 integrantes** más, sin función (no se distingue ayudante, preparador físico, etc.).
- Modelo: tabla nueva `cuerpos_tecnicos` (`torneo_id`, `categoria`, `orden` 0 = técnico y 1–3 = integrantes, `nombre` texto, `notas`, `fuente_ids`), clave (`torneo_id`, `categoria`, `orden`), RLS como `planteles` (lectura pública, escritura de administradores) y auditoría. Explicar el impacto antes: es una tabla nueva, no rompe nada. El nombre es texto libre con sugerencias, no un jugador; si más adelante hace falta seguir a una persona entre torneos, se normaliza.
- **Admin (`#/admin/planteles`)**: bloque "Cuerpo técnico" arriba de la tabla del plantel: campo Técnico, campos Integrante (empieza con uno, "+ Integrante" hasta 3, quitar cada uno). Autocompletar con los nombres ya usados en otros torneos, y sugerir el cuerpo técnico del torneo anterior de la misma categoría ("Usar el del Clausura 2013"). Guardado automático igual que la tabla. "Copiar plantel de…" también copia el cuerpo técnico.
- **Consulta**: en Planteles, el cuerpo técnico arriba de la lista de jugadores ("Técnico: … · Cuerpo técnico: …, …"); en Historial, la columna o línea "Técnico" en cada campaña; en el Detalle del partido, el técnico del torneo debajo de la formación.
- Datos que ya hay para cargar: Jorge Falappa (2012C y 2013C), Rubén Leyes (2011C y 2012A), Mingo Magaz y Andrés Chuard (Reserva 2016C). Están en las observaciones de los partidos; ofrecer pasarlos con un script o cargarlos a mano.

### 6.6.2 Historial contra un rival (`#/historial/rival/:id?cat=P&periodo=todo`) — mockup 12
Hoy "Ver historial completo" lleva a la tabla general de rivales. Pasa a llevar a esta pantalla, con el rival ya elegido. También se llega desde cada fila de la tabla "Contra cada rival" del Historial y desde el nombre del rival en Resultados.
- **Filtros**: rival (lista con escudo), categoría (Primera / Reserva / Las dos) y período (todo o un año), en la URL.
- **Resumen**: los dos escudos, PJ, G, E, P, goles a favor, goles en contra, efectividad (% de puntos) y una barra G/E/P con texto alternativo.
- **Local / Visitante / Playoffs**: tres tarjetas con PJ, G-E-P, goles y efectividad de cada una. Los partidos en cancha neutral van aparte si los hay.
- **Destacados**: mayor goleada, peor derrota (con torneo, fecha y dónde), racha actual (ganados, sin perder o sin ganar, desde cuándo), primer partido y goleadores de Mitre contra ese rival (top 3).
- **Todos los partidos**, del más nuevo al más viejo, agrupados por año: torneo e instancia, día, local/visitante, equipos con el club propio en negrita, marcador, etiqueta G/E/P, penales si hubo, goleadores de Mitre (o "Goleadores sin cargar"). Toda la fila lleva al Detalle del partido. Selector Todos / De local / De visitante / Playoffs.
- Con "Las dos" categorías, cada fila muestra Primera y Reserva del mismo partido juntas.
- Datos: alcanza con `v_partidos` filtrada por rival (y `v_goles` para los goleadores). Si hace falta por rendimiento, una vista `v_rival_resumen` con los totales por rival, categoría, condición y año.
- Incluye borradores solo en modo administrador. Los partidos sin marcador (inferidos) cuentan en PJ y en el resultado, pero no en goles, y se aclara con una nota al pie.
- En el **Detalle del partido**, el recuadro "Contra Susanense · Primera" suma la línea "De local x · de visitante y" y el link "Ver historial completo" va a esta pantalla.

### 6.6.3 Tablas en el celular sin scroll horizontal — mockups 13 a 16
Solo debajo de 720 px; en PC las tablas quedan como están. Referencia: `docs/mockups/MovilHistorial.dc.html`, `MovilPlantel.dc.html`, `MovilPlantelEditar.dc.html` y `MovilTablaCompleta.dc.html`.
- **Regla general:** cada fila de tabla pasa a una **fila de dos líneas** (una tarjeta chica): arriba lo que identifica, abajo los números en una línea corta. Sin encabezados de columna; el orden se elige con un selector **"Ordenar por"** arriba de la lista. Nombres de equipos con `equipos.nombre_corto` y escudo de 30 px. Números en Barlow Condensed. Toda la fila es un link (44 px de alto mínimo) con una flecha al final.
- **Historial · Contra cada rival:** línea 1 escudo + nombre corto + efectividad con mini barra; línea 2 `PJ 25 · 10-4-11 · goles 28–32`. Lleva al historial contra ese rival (6.6.2). Muestra los primeros 9 y "Ver los N rivales".
- **Historial · Campañas:** línea 1 torneo + cómo terminó ("10° · Octavos (pen.)", "En curso" con borde punteado); línea 2 `13 pts · PJ 13 · 2-7-4 · goles 9–10`. Lleva a Resultados de ese torneo. Muestra los últimos 6 y "Ver todas las campañas".
- **Planteles (consulta):** cuerpo técnico arriba. Por jugador: línea 1 apellido, nombre, capitán y puesto; línea 2 chips con lo que tenga (en la lista, de titular, goles, tarjetas). Los ceros no se muestran.
- **Plantel en admin:** lista de nombre, puesto y resumen; al tocar se abre una **hoja desde abajo** (diálogo accesible, foco atrapado, se cierra con Cancelar o deslizando) con apellido, nombre, puesto, apodo, "En el plantel" y el aviso de posible duplicado. Botones **Cancelar** y **Guardar y siguiente** (pasa al jugador siguiente sin cerrar). "+ Agregar jugador" abre la misma hoja vacía, con las sugerencias de jugadores existentes al escribir el apellido. El cuerpo técnico y "Pegar lista" quedan como bloques arriba de la lista.
- **"Ver tabla completa"** (opcional, al lado de "Ordenar por"): abre la tabla original a pantalla completa con la primera columna fija y scroll horizontal dentro de la tabla, botón Cerrar y la nota "Deslizá la tabla hacia el costado". No pide girar el celular.
- Aplicar lo mismo a cualquier otra tabla ancha que quede (Goleadores, historial contra un rival, ficha de jugador), con el mismo componente.

**Criterios de aceptación de la 6.6**
- Contra Susanense en Primera, todo el período: 25 PJ, 10 G, 4 E, 11 P, 28–32; de local 11 PJ (6-2-3, 15–9); de visitante 14 PJ (4-2-8, 13–23); 2 playoffs perdidos; mayor goleada 4–0 (Clausura 2025 F4) y racha actual de 4 triunfos (con los datos de la base al 26/10/2026).
- Desde cada partido de la lista se llega al Detalle y "Atrás" vuelve a la lista con los mismos filtros.
- Se carga el cuerpo técnico de un torneo, aparece en Planteles e Historial, y "Copiar plantel de…" lo trae al torneo siguiente.
- A 390 px no hay ninguna página con scroll horizontal (salvo dentro de "Ver tabla completa"); en PC las tablas no cambian.
- Todo funciona a 390 px de ancho.

---

## Fase 7 — Usuarios, roles y publicación (más adelante)

- Más usuarios con rol (`admin`, `cargador`, `lector`), en una tabla `perfiles` y con políticas RLS por rol.
- Decidir si la consulta se hace pública (por ejemplo, para el canal de WhatsApp del club) o queda solo con login.
- Exportar a Excel desde la app, con la misma estructura de hojas que hoy.
- PWA instalable con modo sin conexión para consulta.
- Conexión con el datawarehouse del Fútbol Mayor (las vistas de la Fase 1 ya son la base de los hechos y dimensiones).

---

## Riesgos y notas

- **Supabase gratis pausa los proyectos inactivos** (sin uso durante alrededor de una semana). Se reactiva desde el panel. Si molesta, un GitHub Action semanal que haga una consulta lo evita.
- **GitHub Pages en plan gratis exige que el repo sea público.** El código va a quedar visible. No hay datos sensibles en el código (los partidos son información pública) y desde la Fase 4 la escritura está protegida. La `service_role key` nunca se sube.
- **Nombres de jugadores incompletos** ("Díaz J.", "Mansilla A."): se cargan así y se completan cuando haya datos. No duplicar jugadores: antes de crear uno nuevo, la app sugiere los parecidos.

## Decisiones de la última revisión
- Repo: `cdm-datos`.
- Escudo real en `assets/`.
- Se cargan goles de los dos equipos e incidencias (rojas y otras) cuando haya datos.
- Solo partidos oficiales: Liga San Martín y copas. Los amistosos no.

## Preguntas abiertas
1. ~~Copa de la Federación~~: es la **Copa Federación** de la Federación Santafesina. Mitre la jugó en 2010 (cargada). Falta saber si la jugó otros años.
