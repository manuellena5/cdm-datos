-- =====================================================================
-- 04_formaciones.sql — Formaciones como vienen en los posteos del club
-- Correr después de 01, 02 y 03. Se puede volver a correr.
-- - Suma el rol 'Convocado (suplente)': estuvo en la lista, no se sabe si entró.
-- - Agrega nro_lista: orden en el posteo (1 a 11 titulares, el resto convocados).
--   camiseta queda para el número real, cuando se sepa.
-- Qué se rompe: nada. La tabla estaba vacía y ninguna vista usa rol ni nro_lista.
-- =====================================================================

alter table formaciones drop constraint if exists formaciones_rol_chk;
alter table formaciones add constraint formaciones_rol_chk
  check (rol in ('Titular', 'Suplente que entró', 'Suplente sin jugar', 'Convocado (suplente)'));

alter table formaciones add column if not exists nro_lista int;
alter table formaciones drop constraint if exists formaciones_nro_lista_chk;
alter table formaciones add constraint formaciones_nro_lista_chk check (nro_lista > 0);
