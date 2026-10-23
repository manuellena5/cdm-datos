# sql/

Scripts para correr en el **SQL Editor** de Supabase, siempre en este orden:

1. `01_esquema.sql` — tablas, controles y trigger de `actualizado_en`.
2. `02_vistas.sql` — vistas desde el punto de vista del club propio (`v_partidos`, `v_campanas`, `v_goleadores`, `v_historial_rival`, `v_faltantes`, `v_disciplina`).
3. `03_permisos.sql` — RLS y lectura pública. **Volver a correrlo cada vez que se corre `02`**, porque las vistas se recrean.
4. `04_formaciones.sql` — rol "Convocado (suplente)" y columna `nro_lista` en formaciones.
5. `05_admin.sql` — modo administrador: tabla `administradores`, escritura solo para administradores, auditoría (`auditoria` y `v_cambios`) y funciones `guardar_partido`, `crear_jugador` y `borrar_borrador`.
6. `06_fase_playoff.sql` — fase "Playoff" (instancia desconocida). Después, volver a correr `02` y `03`.

En una base nueva, `01` ya incluye lo de `04` y `06`.

**Sumar un administrador** (después de crear el usuario en Authentication → Users, con "Auto Confirm User"):
```sql
insert into administradores (user_id, nombre)
select id, 'Nombre' from auth.users where email = 'correo@ejemplo.com';
```
El registro de usuarios tiene que quedar desactivado (Authentication → Sign In / Providers → "Allow new users to sign up").

Se pueden volver a correr sin perder datos: las tablas usan `create … if not exists` y las vistas se borran y se crean de nuevo (no guardan datos).

Un cambio a una tabla que ya existe (agregar una columna, ampliar una lista permitida) va en un script nuevo (`04_…sql`) con `alter table`, explicando antes qué se rompería.
