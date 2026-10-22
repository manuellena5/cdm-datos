# Funcionalidades

Registro de lo que hace la app. Se actualiza con cada funcionalidad nueva o cambiada.

## v0.1.0 — Fase 0 (base)
- **Estructura de la app:** una sola página (`index.html`), sin frameworks, que abre con doble clic o desde GitHub Pages.
- **Encabezado:** escudo del club, nombre y navegación (Resultados, Goleadores, Historial, "Planteles · pronto").
- **Celular (hasta 720 px):** el menú pasa abajo, fijo, con Resultados, Goleadores e Historial.
- **Navegación por hash:** `#/resultados`, `#/partido/:id`, `#/goleadores`, `#/historial`, `#/admin`. Funcionan atrás/adelante del navegador; una dirección desconocida lleva a Resultados. Los filtros van a viajar en la URL (`?anio=…&torneo=…&cat=…`).
- **Pantallas:** todas muestran un recuadro "Pronto" hasta la Fase 3 (consulta) y la Fase 4 (administración).
- **Pie:** versión de la app, estado de la conexión con la base ("Conectado", "Todavía no hay base conectada." o "Sin conexión con la base. Probá de nuevo en un rato.") y link discreto "Administrar".
- **Helpers:** `plural()`, fechas cortas/largas, etiqueta de resultado G/E/P.
