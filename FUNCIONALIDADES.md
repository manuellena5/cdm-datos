# Funcionalidades

Registro de lo que hace la app. Se actualiza con cada funcionalidad nueva o cambiada.

## v0.13.0 — Fase 6.5.4 (formación en 18 lugares)
- En **Cargar / editar partido**, la sección **Formación** de cada categoría es una tabla fija de **18 lugares**: 1 a 11 titulares y 12 a 18 suplentes. Se completa uno por uno; los lugares vacíos no se guardan. "+ Agregar suplente" suma lugares si la lista del partido tiene más de 18.
- Cada lugar tiene un **buscador de jugador**: se escribe parte del apellido o del nombre (sin acentos ni mayúsculas) o se elige de la lista. Primero aparecen los del **plantel de ese torneo**, después los de la categoría y después el resto. No muestra a los que ya están en otro lugar. Flechas para moverse, Enter o clic para elegir, Escape para dejar como estaba. Al elegir, pasa al lugar siguiente.
- "+ Jugador nuevo" (al final de la lista) abre el formulario con lo escrito ("Pérez, Juan" completa apellido y nombre).
- Por jugador: en los suplentes, el rol (**No se sabe si entró** / **Entró** / **No entró**); minuto en que entró o salió, capitán y amarilla, como antes. ✕ vacía el lugar; borrar el nombre también.
- El número de lugar se guarda como orden de la lista. Las formaciones ya cargadas se acomodan solas (titulares primero) y "Copiar de…" el partido anterior llena los mismos lugares.

## v0.12.0 — Fase 6.5.3 (posibles duplicados)
- **Administrar → Jugadores → Posibles duplicados** (`#/admin/jugadores/duplicados`): pares de jugadores con el mismo apellido (sin acentos, sin mayúsculas y con las letras dobles juntadas: Fosarelli y Fossarelli van juntos).
- **A la izquierda**, la lista en dos pestañas: **Pendientes** (primero los más probables: a uno le falta el nombre o tiene la inicial; al final los que aparecen juntos en algún partido, marcados "no pueden ser el mismo") y **Descartados**.
- **A la derecha**, el par elegido: los dos jugadores lado a lado (años, partidos con datos, goles y rojas), si aparecen juntos o no, y la **tabla de los partidos donde aparece cada uno**, en orden de fecha, con cada dato (gol, gol de penal, roja, titular…), "Ver partido" y **"Pasar a …"** por dato: mueve ese gol, tarjeta o fila de formación al otro jugador sin unirlos.
- **Son el mismo**: se elige el apellido y nombre final y se unen (todo pasa a uno solo). No se ofrece si aparecen juntos en algún partido.
- **No son el mismo**: con motivo opcional; el par pasa a Descartados con quién y cuándo, y no vuelve a aparecer como pendiente. "Volver a pendientes" lo deshace.
- **Editar datos** de cada uno (abre Jugadores con ese jugador en edición y vuelve al par al guardar) y **Decidir después** (pasa al siguiente).
- El contador **"Posibles duplicados (N)"** (solo pendientes) está en Jugadores y en el Panel. El "Revisar" de la tabla de Planteles abre ese par.
- Reemplaza la lista de posibles duplicados que había en Jugadores.

## v0.11.0 — Fase 6.5.2 (plantel del torneo en tabla)
- **Administrar → Planteles** (`#/admin/planteles?anio=…&torneo=…&cat=…`) pasa a ser una **tabla editable**, una fila por jugador: en plantel (tilde), apellido, nombre, puesto (Arquero, Defensor, Volante, Delantero), apodo, camiseta (si la lista la usa), goles y rojas del torneo, y **"por qué está"** (goles, roja, formación, incidencia, lista cargada, nuevo).
- **Viene precargada** con los jugadores que tienen algún dato en ese torneo y categoría, más los de la lista. Los que tienen datos quedan siempre (el tilde está bloqueado: jugaron); los que están solo por la lista se pueden destildar o quitar, sin borrar al jugador.
- **Se guarda solo, fila por fila**, con un aviso discreto "Guardado". Apellido, nombre y apodo corrigen al jugador (y avisa si aparece también en otros años); el puesto queda en la lista del torneo. Todo pasa por la auditoría.
- **Para revisar**: sin nombre, o mismo apellido que otro jugador cuando a uno le falta el nombre o tiene solo la inicial ("¿Mismo que Lencina, Emiliano? Revisar").
- **+ Agregar fila**: al escribir el apellido sugiere jugadores existentes (sin acentos ni mayúsculas, con los años en que aparecen) y ofrece "Crear jugador nuevo". Enter pasa a la fila siguiente.
- **Sugeridos**: jugadores del torneo anterior de la misma categoría sin datos en este, con "Sumar" y "Sumar los marcados".
- **Copiar plantel de…** otro torneo.
- **Pegar lista o CSV** (panel al costado): "apellido, nombre, puesto" o columnas de Excel, también desde un .txt/.csv. La previsualización dice por línea si ya está en el plantel, si existe y se suma, si se parece a otro (elegir cuál o crear nuevo) o si es nuevo. Nada se guarda hasta "Sumar al plantel".

## v0.10.0 — Fase 6.5.1 (Resultados en modo administrador)
- **Resultados (admin)** (`#/admin/resultados?anio=…&torneo=…&cat=…&ver=falta`): mismos filtros que la consulta, guardados en la URL. Incluye borradores y todas las fases.
- **Todas las fechas de la fase regular, sin saltos**, de 1 a la cantidad de fechas del torneo (o la última cargada; la cantidad se fija desde la misma pantalla). Cada fecha sin partido aparece en su lugar, punteada:
  - **Posible libre**, con el motivo: la tabla (`posiciones`) muestra que Mitre no jugó o no sumó esa fecha, las observaciones del torneo dicen "Fecha N: Mitre libre", o es la única fecha sin partido del torneo. Es una sugerencia: no se guarda sola.
  - **Pendiente**: sin partido ni indicios. **Falta Primera/Reserva**: hay partido de la otra categoría (abre ese partido para sumarla).
  - **Libre / No se jugó**: marcada, con quién y cuándo, y "Deshacer".
  - Botones "Cargar partido" (abre la carga con torneo y fecha elegidos), "Marcar libre" y "No se jugó".
- **Cada partido**: tarjeta con fecha, equipos, marcador, G/E/P, goles de Mitre y el resultado de la otra categoría, un **lápiz** que abre la carga para corregir, y etiquetas de lo que falta. En naranja (cuentan como faltantes y marcan el partido): borrador, programado vencido, sin resultado, resultado inferido, goleadores de Mitre que no suman, falta la otra categoría de esa fecha. En gris (informativas): goleadores del rival que no suman, sin árbitro, fecha aproximada (de las observaciones). En verde: con formación.
- **Resumen del torneo**: fechas, partidos cargados, libres, fechas sin partido, partidos con faltantes y Pts/PJ/G/E/P. Selector **"Todas las fechas / Solo lo que falta"**.
- **Después de la fase regular**: los partidos de playoff con sus faltantes y "+ Partido de playoff".
- Desde el Panel, "Datos que faltan" tiene el link "Revisar torneo por torneo" (abre esta pantalla en "Solo lo que falta").
- `sql/11_fechas_libres_quien.sql`: guarda quién marcó cada fecha libre.

## v0.9.0 — Fase 6.5.0 (menú de administrador)
- **Menú de administrador** fijo en todas las pantallas de admin (Panel · Resultados · Planteles · Jugadores · Equipos), con la pantalla actual marcada. Queda arriba al bajar por la página. En el celular es una fila con scroll horizontal que se acomoda sola para mostrar la pantalla actual. También está en la pantalla de carga de partido.
- El Panel conserva sus acciones generales: Exportar a Excel, Ver sitio público y Salir.
- **Resultados (admin)** (`#/admin/resultados`): por ahora una pantalla provisoria que remite al Panel; se completa en el punto 6.5.1.

## v0.8.0 — Listas de jugadores, exportar a Excel y app instalable
- **Administrar → Planteles** (`#/admin/planteles`): lista de jugadores de cada torneo y categoría. Se pega la lista (un jugador por línea, "Apellido, Nombre", con el número de camiseta adelante si se tiene; también columnas copiadas de una planilla) o se sube un .txt/.csv. **Revisión** antes de guardar: cada línea se reconoce contra los jugadores existentes (sin importar acentos, mayúsculas ni el orden nombre-apellido) y se puede corregir; las que no coinciden quedan como jugador nuevo (con apellido y nombre editables) y se crean al guardar. Opción de usar la misma lista para el otro torneo del año. Muestra la lista actual (con quitar) y los que jugaron pero no están en la lista ("Agregarlos a la lista").
- **Planteles** (público) incluye a los jugadores de la lista aunque no tengan partidos, con su número de camiseta.
- **Exportar a Excel** (botón del panel de administrador): baja `Historial_Partidos_Mitre_AAAA-MM-DD.xlsx` con la misma estructura de hojas que el Excel original (Partidos, Goles, Incidencias, Formaciones, Sanciones, Jugadores, Equipos, Torneos, Posiciones, Goleadores_Liga, Fuentes) más Planteles y Fechas_libres.
- **App instalable (PWA):** se puede "Agregar a la pantalla de inicio" en el celular, con el escudo como ícono. Sin conexión abre igual y muestra lo último guardado.
- **Escudos** de respaldo en el repo: `assets/escudos/<equipo>.png` (la app usa los de Storage).

## v0.7.0 — Fase 6 (plantel y estadísticas de jugadores)
- **Ficha de jugador** (`#/jugador/:id`): nombre, apodo, posición, división y años en que aparece; totales de goles, partidos, titularidades, amarillas y rojas; tabla por torneo y categoría (cada fila lleva al plantel) y lista de sus partidos con rol, goles y tarjetas (cada uno lleva al Detalle). Se llega desde Goleadores, desde los goles y la formación del Detalle y desde Planteles.
- **Planteles** (`#/planteles?anio=…&torneo=…&cat=…`, ítem "Planteles" del menú, ya activo): plantel por torneo (o todo el año) y categoría con PJ, titular, entró, convocado, minutos (solo si hay datos), goles, amarillas y rojas. Sin formaciones cargadas, el plantel se arma con goleadores y tarjetas, y se avisa.
- **Cómo se cuenta:** jugó = titular, suplente que entró, o sin formación pero con gol o tarjeta. Convocado sin gol ni tarjeta: no se sabe si entró. Minutos solo con minuto de salida o de entrada y salida cargados (no se supone la duración del partido).
- **Carga de formación** en la pantalla de partido (por categoría, opcional): jugadores en orden, rol (Titular, Suplente que entró, Convocado, Suplente sin jugar), minuto de entrada y salida, capitán (uno por categoría) y amarilla. "+ Titular" / "+ Suplente" / "+ Convocado", "+ Jugador nuevo…" y "Copiar de …" (la formación del último partido de la categoría). Aviso si hay jugadores repetidos o más de 11 titulares, y si las observaciones del partido tienen la formación escrita para pasarla.
- La formación queda en la auditoría y hace que la completitud pase a "Completo".
- El Detalle muestra quiénes entraron, convocados y no entraron, con los minutos de entrada y salida.

## v0.6.0 — Fase 4.5 (cierre de la 4, histórico completo, jugadores y escudos)
- **Histórico completo 2010–2026** en la base (631 partidos): Copa Federación 2010 (tipo Copa, fase de grupos con zona) y Liga San Martín 2011–2026. **La base es el único dato maestro:** el importador escribe solo con `--pisar-la-base` y se usa para `--dry-run`.
- **Carga de partidos, completa:** selector de **Estado** por categoría (Jugado, Programado, Suspendido, Postergado, Ganado por mesa, Sin dato) y **Resultado sin marcador** (Ganó / Empató / Perdió → completitud "Inferido"). Editar un partido suspendido o inferido ya no lo pisa.
- **Registro de cambios** más claro: nombra el partido aunque se haya borrado ("borró F14 vs Trebolense"), y muestra correcciones y uniones de jugadores y cambios de escudo.
- **Jugadores** (`#/admin/jugadores`, desde el panel): buscador; por jugador, años en que aparece, goles y partidos. Editar apellido, nombre, apodo y notas (el ID no se toca). **Unir jugadores:** se eligen dos (o "Elegir estos" en los posibles duplicados, que se arman por apellido) y cuál queda; goles, incidencias, formaciones, sanciones y goleadores de la Liga pasan al que queda, se completan sus datos vacíos, se juntan las notas y se borra el sobrante. Si los dos están en la misma formación, no se unen.
- **Escudos:** en las tarjetas de Resultados (24 px), el Detalle del partido (48 px), la tabla de rivales del Historial y la pantalla de carga. Sin escudo, un círculo gris con las iniciales del mismo tamaño. El club propio usa el escudo del repo si no tiene otro.
- **Equipos** (`#/admin/equipos`, desde el panel): subir, cambiar o quitar el escudo de cada equipo (Supabase Storage, bucket público `escudos`), sin depender de un commit.
- La auditoría registra también jugadores y equipos.

## v0.5.0 — Fase 4 (modo administrador)
- **Ingreso** (`#/admin`, link "Administrar" del pie): usuario y clave, con mostrar/ocultar y "Volver al historial". La sesión queda recordada en el dispositivo. El registro de usuarios está cerrado: los usuarios se crean a mano en Supabase.
- **Quién puede escribir:** solo los usuarios de la tabla `administradores`. Sin sesión, o con sesión sin ser administrador, no se puede insertar, cambiar ni borrar nada (ni llamando directo a la base con la anon key).
- **Panel** (`#/admin`): partidos para cargar (el próximo resaltado, con "Cargar resultado"; los demás con "Editar programación"), últimos cargados (resultado de Primera y Reserva, qué falta, Publicado/Borrador y Editar), datos que faltan, registro de cambios ("Manuel publicó F12 vs Trebolense"), "+ Partido fuera del fixture", "Ver sitio público" y "Salir". Aviso de lo que se acaba de guardar.
- **Cargar / editar partido** (`#/admin/partido/:id`), pensada para el celular: torneo y fecha/instancia (incluye playoff con serie ida/vuelta y "Playoff" sin instancia); al elegirlos se completan rival, condición, día y cancha desde el fixture. Primera y Reserva con marcador −/+, una fila por gol propio (jugador, minuto y tipo: Jugada, Penal, Tiro libre, En contra) y por gol del rival (nombre con sugerencias y minuto, opcionales), penales si es playoff empatado, hora y árbitro. "+ Jugador nuevo…" con aviso de jugadores con el mismo apellido. Incidencias opcionales. Link de la fuente y observaciones. Aviso suave si faltan goleadores (no impide guardar). Botones Guardar borrador / Publicar, o Guardar programación si todavía no hay resultado. Eliminar borrador (solo partidos que nunca se publicaron). El formulario se guarda en el navegador mientras se edita y ofrece recuperarlo si se cerró la página.
- **Guardado atómico** (`guardar_partido`): Primera y Reserva, goles, incidencias y fuente en una sola transacción; la completitud se calcula sola.
- **Borradores:** no aparecen en la consulta y no suman en campañas, goleadores, historial ni disciplina, ni siquiera con sesión iniciada. Al publicar, se actualiza todo.
- **Auditoría:** cada alta, cambio o baja de partidos, goles e incidencias queda registrada con quién y cuándo; lo que entra por el importador queda como "Importación".
- **Fase "Playoff"** para partidos de playoff cuya instancia no se conoce.

## v0.4.0 — Fase 3 (páginas de consulta)
- **Resultados** (`#/resultados?anio=2026&torneo=C&cat=P`): filtros de año, torneo (Apertura, Clausura, copas o "Todo el año") y categoría, guardados en la URL. Por defecto, el torneo más reciente y Primera. Resumen con Pts, PJ, G, E, P, GF y GC. Una tarjeta por partido: fecha, equipos (el club propio en negrita), marcador, etiqueta G/E/P, goleadores propios e ícono de roja con la cantidad. Los playoffs van al final con su instancia y los penales; los programados muestran la hora (o "A conf.") con la etiqueta punteada. En el celular: filtros dentro del encabezado azul y tarjeta compacta con los equipos uno arriba del otro.
- **Detalle del partido** (`#/partido/:id`): marcador grande, fecha, estadio, árbitro y posición en la tabla después de esa fecha (si está cargada). Goles de Primera y Reserva del mismo partido (local a la izquierda, visitante a la derecha, con minuto o tiempo si se sabe; aviso si faltan goleadores). Incidencias con un ícono por tipo. Formación (titulares, convocados y capitán) o el recuadro vacío. Historial contra ese rival con los últimos 5 cruces y link al historial completo. Fuentes con link y completitud.
- **Goleadores** (`#/goleadores?anio=2026&torneo=todo`): filtros de año (incluye "Todos") y torneo. Tarjetas con el máximo goleador de Primera y de Reserva (con el desglose por torneo y el puesto en la Liga si lo dice el boletín). Tablas con puesto (los empates comparten puesto), barra, goles por torneo y total. Al pie, los goles en contra de rivales y los goles sin autor conocido.
- **Historial** (`#/historial?cat=P&periodo=2026`): campañas por torneo (cada fila lleva a Resultados) con "cómo terminó" (posición, zona, en curso, eliminado en tal instancia, campeón, con "(pen.)" si fue por penales). Datos destacados del período: mayor goleada, peor derrota y rivales contra los que no perdió. Tabla contra cada rival con % de puntos. El período aplica a destacados y rivales.
- **Sin conexión:** lo ya pedido queda en memoria y la última respuesta se guarda en el navegador. Sin red se muestra lo guardado con el aviso "Sin conexión. Estás viendo los últimos datos guardados.", y si no hay nada guardado, un mensaje claro. Cada consulta espera 10 s como máximo; después de un corte, las siguientes van directo a lo guardado por 30 s.
- **Vistas nuevas** (`sql/02_vistas.sql`): `v_goles`, `v_incidencias` y `v_formaciones` (con el lado propio/rival y el nombre para mostrar). `v_campanas` suma zona, resultado de la última llave de playoff (ida y vuelta sumadas), si fue por penales, rival y goles sin autor.
- **Caché del navegador:** los archivos propios se cargan con `?v=<versión>` en `index.html`, así cada versión publicada se baja de nuevo.
- Tablas anchas con scroll dentro de su recuadro y la primera columna fija; links y botones de 44 px de alto como mínimo.

## v0.3.0 — Fase 2 (importación del Excel)
- **Importador** (`scripts/importar_excel.py`): lleva el Excel a Supabase. Valida antes de escribir, tiene modo `--dry-run`, escribe solo lo que cambió y se puede correr varias veces sin duplicar. Al final verifica las cifras de control. Frena si la base tiene datos cargados desde la app (`--forzar` para pasar por encima). Ver `scripts/README.md`.
- **Formaciones** (`sql/04_formaciones.sql`): rol "Convocado (suplente)" (estuvo en la lista, no se sabe si entró) y orden en la lista del posteo (`nro_lista`).
- **Datos cargados:** 248 partidos (2021–2026), 288 goles, 26 incidencias, 296 filas de formación (Clausura 2023), 89 jugadores, 16 equipos, 11 torneos, 18 posiciones, 17 goleadores de la Liga y 132 fuentes.

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
