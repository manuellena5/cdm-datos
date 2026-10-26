# assets/escudos/

Respaldo de los escudos de los equipos, con el nombre `<equipo_id>.png` (por ejemplo `TRE.png`).

La app muestra el escudo que está cargado en Supabase Storage (bucket `escudos`), que se sube o cambia desde **Administrar → Equipos**, sin commit. Estos archivos son la copia de respaldo.

- `recreativo-las-petacas.png` y `crispi.png`: equipos que todavía no están cargados. Cuando se sumen, renombrar con su `equipo_id` y subirlos desde Equipos.
- América (CG) `AMC`, Combate `CSL` y Unión (T) `UTO`: archivos agregados; para que se vean en la app, subirlos desde Administrar → Equipos.
- Mitre usa `assets/escudo.png` / `assets/escudo-192.png` si no tiene uno cargado en Storage.
