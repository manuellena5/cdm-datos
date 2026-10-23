# scripts/

Herramientas que corren en la PC, fuera de la web.

## importar_excel.py

> **⚠ La base es el único dato maestro (desde el 23/10/2026, Fase 4.5.2).**
> El Excel quedó congelado (`Historial_Partidos_Mitre_congelado.xlsx`) con 2010–2026: 631 partidos y 652 goles.
> Todo lo nuevo y toda corrección se cargan desde la app (`#/admin`).
> El importador queda **solo para `--dry-run`** (comparar el Excel contra la base). Si se vuelve a correr en serio,
> **pisa las correcciones hechas en la base** (jugadores unidos, goles corregidos, partidos editados).

Importa `Historial_Partidos_Mitre.xlsx` a Supabase.

**Preparación (una vez):**
1. `pip install -r scripts/requirements.txt`
2. Copiar `.env.example` como `.env` y completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API) y `EXCEL_PATH`. El `.env` no se sube al repo.

**Uso (desde la raíz del repo):**
```
python scripts/importar_excel.py --dry-run     # valida y muestra qué cambiaría, sin escribir
python scripts/importar_excel.py --pisar-la-base   # importa de verdad (ver el aviso de arriba)
python scripts/importar_excel.py --verificar   # solo verifica las cifras de control
```

**Qué hace:**
- Valida todo antes de escribir (listas permitidas, referencias entre hojas, repetidos, marcador completo, que el club propio juegue cada partido, fuentes existentes). Con cualquier error no escribe nada.
- Compara con la base y escribe solo lo nuevo o lo que cambió. Se puede correr varias veces sin duplicar.
- Fuentes, torneos, equipos, jugadores, partidos, posiciones y goleadores de la Liga: se actualizan por su clave. Lo que está en la base y no en el Excel **no se borra**, solo se avisa.
- Goles, incidencias y formación de cada partido del Excel quedan **exactamente** como en el Excel. Sanciones también.
- Ignora las columnas grises (calculadas) y las hojas LEEME, Resumen, Revisar y Listas.
- El club propio se marca con `--club-propio` (por defecto `MIT`).

**Cuidado desde la Fase 4:** la base pasa a ser el dato maestro. Si la base tiene partidos que no están en el Excel o borradores (cargados desde la app), el importador frena. `--forzar` lo pasa por encima, pero puede pisar lo cargado en la app.
