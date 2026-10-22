# sql/

Scripts para correr en el **SQL Editor** de Supabase, siempre en este orden:

1. `01_esquema.sql` — tablas, controles y trigger de `actualizado_en`.
2. `02_vistas.sql` — vistas desde el punto de vista del club propio (`v_partidos`, `v_campanas`, `v_goleadores`, `v_historial_rival`, `v_faltantes`, `v_disciplina`).
3. `03_permisos.sql` — RLS y lectura pública. **Volver a correrlo cada vez que se corre `02`**, porque las vistas se recrean.
4. `04_formaciones.sql` — rol "Convocado (suplente)" y columna `nro_lista` en formaciones.

Se pueden volver a correr sin perder datos: las tablas usan `create … if not exists` y las vistas se borran y se crean de nuevo (no guardan datos).

Un cambio a una tabla que ya existe (agregar una columna, ampliar una lista permitida) va en un script nuevo (`04_…sql`) con `alter table`, explicando antes qué se rompería.
