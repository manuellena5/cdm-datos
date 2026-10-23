# Historial de partidos — Club Deportivo Mitre
Plan de desarrollo por fases para trabajar con Claude Code.

> Cómo usar este documento: pedile a Claude Code **una fase por vez** ("Hacé la Fase 1 de docs/PLAN.md").
> Cada fase tiene alcance, entregables y criterios de aceptación. No avanzar a la siguiente sin cerrar los criterios de la anterior.

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
