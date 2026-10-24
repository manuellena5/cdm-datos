// Exportar la base a Excel (Fase 7), con la misma estructura de hojas que Historial_Partidos_Mitre.xlsx.
// La librería (SheetJS) se baja recién al exportar.
window.CDM = window.CDM || {};

CDM.exportar = (function () {
  const LIBRERIA = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

  // [hoja, tabla, orden, columnas: [columna en el Excel, columna en la base]]
  const HOJAS = [
    ['Partidos', 'partidos', 'partido_id', [
      ['partido_id'], ['torneo_id'], ['fase'], ['fecha_nro'], ['fecha_partido', 'fecha'], ['hora'], ['categoria'], ['local_id'], ['visitante_id'],
      ['goles_local'], ['goles_visitante'], ['resultado_informado'], ['penales_local'], ['penales_visitante'], ['zona'], ['serie'],
      ['cancha'], ['arbitro'], ['estado'], ['completitud'], ['fuente_id', 'fuente_ids'], ['observaciones'], ['publicado']]],
    ['Goles', 'goles', 'gol_id', [['gol_id'], ['partido_id'], ['equipo_id'], ['jugador_id'], ['nombre_en_fuente'], ['minuto'], ['tiempo'], ['tipo'], ['observaciones']]],
    ['Incidencias', 'incidencias', 'id', [['partido_id'], ['equipo_id'], ['jugador_id'], ['nombre_en_fuente'], ['tipo'], ['minuto'], ['tiempo'], ['descripcion']]],
    ['Formaciones', 'formaciones', 'partido_id', [['partido_id'], ['jugador_id'], ['rol'], ['nro_lista'], ['camiseta'], ['minuto_entra'], ['minuto_sale'], ['capitan'], ['observaciones']]],
    ['Sanciones', 'sanciones', 'id', [['jugador_id'], ['nombre_en_fuente'], ['torneo_id'], ['fecha_resolucion'], ['fechas_suspension'], ['motivo'], ['boletin_nro'], ['fuente_id', 'fuente_ids']]],
    ['Jugadores', 'jugadores', 'jugador_id', [['jugador_id'], ['apellido'], ['nombre'], ['apodo'], ['posicion'], ['division'], ['fuente_id', 'fuente_ids'], ['notas']]],
    ['Equipos', 'equipos', 'equipo_id', [['equipo_id'], ['nombre'], ['nombre_corto'], ['localidad'], ['cancha'], ['notas'], ['escudo']]],
    ['Torneos', 'torneos', 'torneo_id', [['torneo_id'], ['anio'], ['nombre'], ['formato'], ['campeon'], ['notas'], ['fuente_id', 'fuente_ids'], ['tipo'], ['competicion'], ['fechas_regular']]],
    ['Planteles', 'planteles', 'torneo_id', [['torneo_id'], ['categoria'], ['jugador_id'], ['camiseta'], ['posicion'], ['notas']]],
    ['Fechas_libres', 'fechas_libres', 'torneo_id', [['torneo_id'], ['fecha_nro'], ['motivo']]],
    ['Posiciones', 'posiciones', 'id', [['torneo_id'], ['categoria'], ['tras_fecha'], ['posicion'], ['pts'], ['PJ', 'pj'], ['G', 'g'], ['E', 'e'], ['P', 'p'], ['DG', 'dg'], ['fuente_id', 'fuente_ids'], ['observaciones']]],
    ['Goleadores_Liga', 'goleadores_liga', 'id', [['torneo_id'], ['categoria'], ['jugador_id'], ['nombre_en_boletin'], ['goles'], ['puesto_liga', 'puesto'], ['actualizado'], ['fuente_id', 'fuente_ids']]],
    ['Fuentes', 'fuentes', 'fuente_id', [['fuente_id'], ['medio'], ['fecha_publicacion'], ['que_cubre'], ['url']]]
  ];
  const FECHAS = new Set(['fecha', 'fecha_resolucion', 'fecha_publicacion', 'actualizado']);

  let carga = null;
  function cargarLibreria() {
    if (window.XLSX) return Promise.resolve();
    if (!carga) {
      carga = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = LIBRERIA;
        s.onload = ok;
        s.onerror = () => { carga = null; mal(new Error('Sin conexión. No se pudo preparar el Excel; probá de nuevo.')); };
        document.head.appendChild(s);
      });
    }
    return carga;
  }

  function valor(columna, v) {
    if (v == null) return null;
    if (Array.isArray(v)) return v.join(',');
    if (FECHAS.has(columna) && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [a, m, d] = v.split('-').map(Number);
      return new Date(a, m - 1, d);
    }
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return v;
  }

  async function excel(avance) {
    await cargarLibreria();
    const libro = window.XLSX.utils.book_new();
    for (const [hoja, tabla, orden, columnas] of HOJAS) {
      if (avance) avance(hoja);
      let filas;
      try {
        filas = await CDM.api.admin.tabla(tabla, orden);
      } catch (err) {
        throw new Error('Sin conexión. No se pudo armar el Excel; probá de nuevo.');
      }
      const datos = filas.map((f) => Object.fromEntries(columnas.map(([excelCol, baseCol]) => [excelCol, valor(baseCol || excelCol, f[baseCol || excelCol])])));
      const ws = window.XLSX.utils.json_to_sheet(datos, { header: columnas.map((c) => c[0]), cellDates: true, dateNF: 'dd/mm/yyyy' });
      ws['!cols'] = columnas.map(([c]) => ({ wch: Math.max(10, Math.min(40, c.length + 4)) }));
      window.XLSX.utils.book_append_sheet(libro, ws, hoja);
    }
    const hoy = new Date();
    const dos = (n) => String(n).padStart(2, '0');
    const nombre = 'Historial_Partidos_Mitre_' + hoy.getFullYear() + '-' + dos(hoy.getMonth() + 1) + '-' + dos(hoy.getDate()) + '.xlsx';
    window.XLSX.writeFile(libro, nombre, { cellDates: true });
    return nombre;
  }

  return { excel };
})();
