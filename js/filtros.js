// Años y torneos disponibles, armados desde v_campanas. Los usan Resultados, Goleadores e Historial.
// En la URL el torneo va por su letra (A, C, …): '2026C' → anio=2026&torneo=C.
window.CDM = window.CDM || {};

CDM.filtros = (function () {
  const sufijo = (torneoId) => String(torneoId).slice(4);

  // Torneos únicos, del más viejo al más nuevo.
  function torneos(campanas) {
    const vistos = new Map();
    campanas.forEach((c) => {
      if (!vistos.has(c.torneo_id)) {
        vistos.set(c.torneo_id, {
          id: c.torneo_id, anio: c.anio, nombre: c.torneo, tipo: c.torneo_tipo,
          orden: c.torneo_orden, letra: sufijo(c.torneo_id)
        });
      }
    });
    return [...vistos.values()].sort((a, b) => a.orden - b.orden);
  }

  function anios(campanas) {
    return [...new Set(campanas.map((c) => c.anio))].sort((a, b) => b - a);
  }

  // Resuelve año + torneo pedidos en la URL, con valores por defecto válidos.
  // Devuelve { anio, letra ('todo' o la letra), torneo (objeto o null) }.
  function elegirTorneo(campanas, query) {
    const lista = torneos(campanas);
    if (!lista.length) return { anio: null, letra: 'todo', torneo: null };
    const ultimo = lista[lista.length - 1];
    let anio = Number(query.get('anio'));
    if (!lista.some((t) => t.anio === anio)) anio = ultimo.anio;
    const delAnio = lista.filter((t) => t.anio === anio);
    const pedido = query.get('torneo');
    if (pedido === 'todo') return { anio, letra: 'todo', torneo: null };
    const torneo = delAnio.find((t) => t.letra === pedido) || delAnio[delAnio.length - 1];
    return { anio, letra: torneo.letra, torneo };
  }

  function categoria(query) {
    return query.get('cat') === 'R' ? 'R' : 'P';
  }
  const nombreCategoria = (c) => (c === 'R' ? 'Reserva' : 'Primera');

  // Opciones del selector de torneo de un año: cada torneo + "Todo el año".
  function opcionesTorneo(campanas, anio) {
    const delAnio = torneos(campanas).filter((t) => t.anio === anio).reverse();
    return delAnio.map((t) => ({ valor: t.letra, texto: t.tipo === 'Copa' ? t.nombre : CDM.ui.torneoSinAnio(t.nombre) }))
      .concat([{ valor: 'todo', texto: 'Todo el año' }]);
  }

  // Orden de los partidos dentro de un listado.
  function ordenarPartidos(lista) {
    const serie = (s) => (s === 'Ida' ? 0 : s === 'Vuelta' ? 1 : 0);
    return lista.slice().sort((a, b) =>
      a.torneo_orden - b.torneo_orden ||
      a.fase_orden - b.fase_orden ||
      serie(a.serie) - serie(b.serie) ||
      (a.fecha_nro ?? 999) - (b.fecha_nro ?? 999) ||
      String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
  }

  return { sufijo, torneos, anios, elegirTorneo, categoria, nombreCategoria, opcionesTorneo, ordenarPartidos };
})();
