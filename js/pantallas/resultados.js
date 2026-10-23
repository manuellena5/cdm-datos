// Resultados (#/resultados?anio=2026&torneo=C&cat=P) — mockups Main y Móvil.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.resultados = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  let actual = null;   // filtros resueltos en el último render, para montar()

  function resumen(filas) {
    const s = { pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
    filas.forEach((c) => Object.keys(s).forEach((k) => { s[k] += c[k] || 0; }));
    const tile = (k, v, destacado) =>
      '<div class="dato' + (destacado ? ' dato--destacado' : '') + '"><div class="dato__k">' + k +
      '</div><div class="dato__v">' + v + '</div></div>';
    return '<section class="resumen" aria-label="Resumen del torneo">' +
      '<div class="resumen__pc">' +
      tile('PUNTOS', s.pts, true) + tile('JUGADOS', s.pj) + tile('GANADOS', s.g) + tile('EMPATADOS', s.e) +
      tile('PERDIDOS', s.p) + tile('GOLES A FAVOR', s.gf) + tile('GOLES EN CONTRA', s.gc) +
      '</div><div class="resumen__cel">' +
      tile('Pts', s.pts, true) + tile('G-E-P', s.g + '-' + s.e + '-' + s.p) + tile('GF', s.gf) + tile('GC', s.gc) +
      '</div></section>';
  }

  function tarjeta(p, propio, equipos) {
    const nombre = (id, texto) => '<span class="partido__nombre con-escudo">' + ui.escudo(equipos[id], 24) +
      '<span class="partido__texto">' + e(texto) + '</span></span>';
    const local = p.condicion === 'L';
    const goles = (n) => (n == null ? '' : n);
    const pen = ui.penales(p);
    // En el celular no hay marcador central: la hora o los penales van en la línea de abajo.
    const extraCel = [pen, p.goles_local == null ? ui.marcador(p) : ''].filter(Boolean).join(' · ');
    const etiqueta = (local ? p.local + ' ' : p.visitante + ' ') + 'contra ' + (local ? p.visitante : p.local);
    return '<a class="partido" href="#/partido/' + encodeURIComponent(p.partido_id) + '" aria-label="Detalle: ' +
      e(etiqueta + ', ' + ui.instanciaLarga(p)) + '">' +
      '<div class="partido__fecha"><span class="partido__nro">' + e(ui.instancia(p)) + '</span>' +
      '<span class="partido__dia">' + e(ui.fechaCorta(p.fecha) || 'Sin fecha') + '</span></div>' +
      '<div class="partido__eq partido__eq--local' + (local ? ' es-propio' : '') + '">' + nombre(p.local_id, p.local) +
      '<span class="partido__goles">' + goles(p.goles_local) + '</span></div>' +
      '<div class="partido__marcador' + (p.goles_local == null ? ' partido__marcador--sin' : '') + '">' +
      e(ui.marcador(p)) + (pen ? '<small>' + e(pen) + '</small>' : '') + '</div>' +
      '<div class="partido__eq partido__eq--visitante' + (!local ? ' es-propio' : '') + '">' + nombre(p.visitante_id, p.visitante) +
      '<span class="partido__goles">' + goles(p.goles_visitante) + '</span></div>' +
      '<div class="partido__lado">' + ui.rojas(p.rojas) + ui.chipResultado(p.resultado, ui.tituloChip(p)) +
      '<span class="partido__detalle">Detalle</span></div>' +
      (p.goles_mitre_texto ? '<div class="partido__goleadores"><strong>' + e(propio.nombre_corto) + ':</strong> ' +
        e(p.goles_mitre_texto) + (extraCel ? ' <span class="partido__pen-cel">· ' + e(extraCel) + '</span>' : '') + '</div>'
        : (extraCel ? '<div class="partido__goleadores partido__pen-cel">' + e(extraCel) + '</div>' : '')) +
      '</a>';
  }

  async function render(params, query) {
    const [partidos, campanas, listaEquipos] = await Promise.all([
      CDM.api.partidos(), CDM.api.campanas(), CDM.api.equipos()
    ]);
    const propio = listaEquipos.find((x) => x.es_propio) || { nombre_corto: '' };
    const equipos = Object.fromEntries(listaEquipos.map((x) => [x.equipo_id, x]));
    const sel = filtros.elegirTorneo(campanas, query);
    const cat = filtros.categoria(query);
    const categoria = filtros.nombreCategoria(cat);
    actual = { anio: sel.anio, torneo: sel.letra, cat };

    const enSeleccion = (x) => x.anio === sel.anio && (sel.letra === 'todo' || x.torneo_id === sel.torneo.id) &&
      x.categoria === categoria;
    const lista = filtros.ordenarPartidos(partidos.filter(enSeleccion));
    const filasResumen = campanas.filter(enSeleccion);

    const controles = '<section class="filtros filtros--encabezado" aria-label="Filtros">' +
      ui.selector('anio', 'Año', filtros.anios(campanas).map((a) => ({ valor: a, texto: a })), sel.anio) +
      ui.selector('torneo', 'Torneo', filtros.opcionesTorneo(campanas, sel.anio), sel.letra) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) +
      '</section>';

    const titulo = (sel.torneo ? sel.torneo.nombre : 'Año ' + sel.anio) + ' · ' + categoria;
    let cuerpo;
    if (!lista.length) {
      cuerpo = ui.vacio('No hay partidos de ' + categoria + ' cargados para este torneo.');
    } else if (sel.letra === 'todo') {
      const grupos = new Map();
      lista.forEach((p) => { if (!grupos.has(p.torneo)) grupos.set(p.torneo, []); grupos.get(p.torneo).push(p); });
      cuerpo = [...grupos].map(([nombre, ps]) => '<h2 class="subtitulo">' + e(nombre) + '</h2>' +
        ps.map((p) => tarjeta(p, propio, equipos)).join('')).join('');
    } else {
      cuerpo = lista.map((p) => tarjeta(p, propio, equipos)).join('');
    }

    return controles + resumen(filasResumen) +
      '<section class="partidos" aria-label="Partidos"><h1 class="titulo-pantalla">' + e(titulo) + '</h1>' +
      cuerpo + '</section>';
  }

  function montar(contenedor) {
    const ir = (cambios) => CDM.router.cambiarFiltros('/resultados', Object.assign({}, actual, cambios));
    contenedor.addEventListener('change', (ev) => {
      const f = ev.target.dataset.filtro;
      if (f === 'anio') ir({ anio: ev.target.value, torneo: undefined });
      if (f === 'torneo') ir({ torneo: ev.target.value });
    });
    contenedor.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-seg="cat"]');
      if (b) ir({ cat: b.dataset.valor });
    });
  }

  return { titulo: 'Resultados', seccion: 'resultados', render, montar };
})();
