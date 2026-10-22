# cdm-datos

Web para consultar (y luego cargar) el historial de partidos oficiales (Liga San Martín y copas) de Primera y Reserva del Club Deportivo Mitre (Landeta).

- Plan por fases: `docs/PLAN.md`. Trabajar **una fase por vez** y cerrar sus criterios de aceptación antes de seguir.
- Mockups aprobados: `docs/mockups/*.dc.html` (referencia visual; no es código para copiar). Escudo: `assets/escudo.png`. Azul club `#062F5A`.
- Solo partidos oficiales: Liga San Martín y copas. Sin amistosos.
- Stack: HTML + CSS + JS sin frameworks · Supabase (Postgres + Auth) · GitHub Pages.
- Datos de partida: `Historial_Partidos_Mitre.xlsx` (carpeta Drive "Gestion Club"), se importa en la Fase 2.

## Convenciones
- Todo lo visible en español rioplatense, mensajes cortos y en presente.
- Nunca mostrar IDs internos, nombres de tablas, URLs de backend ni errores técnicos en pantalla.
- Errores en términos del usuario ("Sin conexión. Estás viendo los últimos datos guardados.").
- Helper `plural(n, sing, plur)`; nunca "gol(es)".
- El club propio sale de `equipos.es_propio`, no se hardcodea.
- La lógica "desde el punto de vista de Mitre" (GF, GC, G/E/P) vive en vistas SQL, no en el frontend.
- `APP_VERSION` visible en el pie; si hay service worker, subir su cache en el mismo cambio.
- La `service_role key` nunca va al repo (`.env` en `.gitignore`). En el frontend solo la `anon key`.
- Antes de cambiar el modelo de datos: explicar qué se rompería y después hacerlo.
- Verificar en el navegador (390 px y 1280 px) antes de dar algo por terminado y contar qué se probó.
- No commitear ni pushear sin que M lo pida.
- Mantener `FUNCIONALIDADES.md` actualizado con cada funcionalidad nueva o cambiada.
