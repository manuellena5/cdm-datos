// Planteles (#/planteles?anio=2023&torneo=C&cat=P) — Fase 6.
// Plantel por torneo y categoría, armado con formaciones, goles y tarjetas.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.planteles = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  const num = (v) => Number(v || 0);
  let actual = null;

  async function render(params, query) {
    const [plantel, campanas, partidos, cuerpos] = await Promise.all([CDM.api.plantel(), CDM.api.campanas(), CDM.api.partidos(), CDM.api.cuerposTecnicos()]);
    const sel = filtros.elegirTorneo(campanas, query);
    const cat = filtros.categoria(query);
    const categoria = filtros.nombreCategoria(cat);
    actual = { anio: sel.anio, torneo: sel.letra, cat };
    const enSel = (x) => x.anio === sel.anio && (sel.letra === 'todo' || x.torneo_id === sel.torneo.id) && x.categoria === categoria;

    // Sumar por jugador (si es "Todo el año", junta los torneos del año)
    const porJugador = new Map();
    plantel.filter(enSel).forEach((x) => {
      if (!porJugador.has(x.jugador_id)) porJugador.set(x.jugador_id, { jugador_id: x.jugador_id, jugador: x.jugador, partidos: 0, titular: 0, entro: 0, convocado: 0, goles: 0, amarillas: 0, rojas: 0, minutos: 0, conMinutos: false, enLista: false, camiseta: null });
      const j = porJugador.get(x.jugador_id);
      if (x.en_lista) { j.enLista = true; if (x.camiseta != null && j.camiseta == null) j.camiseta = x.camiseta; }
      ['partidos', 'titular', 'entro', 'convocado', 'goles', 'amarillas', 'rojas'].forEach((k) => { j[k] += num(x[k]); });
      if (x.minutos != null) { j.minutos += num(x.minutos); j.conMinutos = true; }
    });
    const lista = [...porJugador.values()].sort((a, b) => b.partidos - a.partidos || b.titular - a.titular || b.goles - a.goles || a.jugador.localeCompare(b.jugador, 'es'));
    const hayMinutos = lista.some((j) => j.conMinutos);
    const hayCamisetas = lista.some((j) => j.camiseta != null);
    const enLista = lista.filter((j) => j.enLista).length;

    const jugados = partidos.filter((p) => enSel(p) && p.resultado);
    const conFormacion = new Set(plantel.filter(enSel).filter((x) => num(x.titular) + num(x.entro) + num(x.convocado) > 0).map((x) => x.torneo_id));

    const controles = '<section class="filtros" aria-label="Filtros">' +
      ui.selector('anio', 'Año', filtros.anios(campanas).map((a) => ({ valor: a, texto: a })), sel.anio) +
      ui.selector('torneo', 'Torneo', filtros.opcionesTorneo(campanas, sel.anio), sel.letra) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) + '</section>';

    const titulo = (sel.torneo ? sel.torneo.nombre : 'Año ' + sel.anio) + ' · ' + categoria;
    const filas = lista.map((j) => '<tr><th scope="row">' + (hayCamisetas ? '<span class="lista__camiseta">' + (j.camiseta ?? '') + '</span>' : '') +
      '<a href="#/jugador/' + encodeURIComponent(j.jugador_id) + '">' + e(j.jugador) + '</a></th>' +
      '<td class="centro">' + j.partidos + '</td><td class="centro">' + j.titular + '</td><td class="centro">' + j.entro + '</td>' +
      '<td class="centro">' + j.convocado + '</td>' + (hayMinutos ? '<td class="centro">' + (j.conMinutos ? j.minutos : '–') + '</td>' : '') +
      '<td class="total centro">' + j.goles + '</td><td class="centro">' + j.amarillas + '</td><td class="centro">' + j.rojas + '</td></tr>').join('');
    const nota = (enLista ? 'Lista del torneo cargada (' + ui.plural(enLista, 'jugador', 'jugadores') + '). ' : '') + (conFormacion.size
      ? 'Con formación cargada: PJ, titular, entró y convocado salen de las formaciones.'
      : 'Este torneo todavía no tiene formaciones cargadas: PJ cuenta solo los partidos con gol o tarjeta.');

    // Cuerpo técnico arriba de la lista; con "Todo el año", uno por torneo
    const torneosSel = sel.torneo ? [sel.torneo] : filtros.torneos(campanas).filter((t) => t.anio === sel.anio);
    const lineasCuerpo = torneosSel.map((t) => ({ t, c: ui.cuerpoTecnico(cuerpos, t.id, categoria) })).filter((x) => x.c.html)
      .map((x) => '<p class="cuerpo-tecnico">' + (sel.torneo ? '' : '<span class="texto-2">' + e(ui.torneoSinAnio(x.t.nombre)) + ':</span> ') + x.c.html + '</p>').join('');

    return controles + '<section class="tarjeta" aria-label="Plantel"><h1 class="tarjeta__titulo">' + e(titulo) + '</h1>' + lineasCuerpo +
      '<p class="nota">' + ui.plural(lista.length, 'jugador', 'jugadores') + ' · ' + ui.plural(jugados.length, 'partido jugado', 'partidos jugados') + '</p>' +
      (lista.length
        ? '<div class="tabla-scroll"><table class="tabla tabla--plantel"><thead><tr><th>Jugador</th>' +
          '<th class="centro" title="Partidos jugados">PJ</th><th class="centro" title="Titular">Tit.</th><th class="centro" title="Suplente que entró">Entró</th>' +
          '<th class="centro" title="Convocado, no se sabe si entró">Conv.</th>' + (hayMinutos ? '<th class="centro">Min.</th>' : '') +
          '<th class="centro">Goles</th><th class="centro" title="Amarillas">Am.</th><th class="centro">Rojas</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : ui.vacio('Todavía no hay jugadores cargados para este torneo.')) +
      '<p class="nota">' + e(nota) + '</p></section>';
  }

  function montar(vista) {
    const ir = (cambios) => CDM.router.cambiarFiltros('/planteles', Object.assign({}, actual, cambios));
    vista.addEventListener('change', (ev) => {
      const f = ev.target.dataset.filtro;
      if (f === 'anio') ir({ anio: ev.target.value, torneo: undefined });
      if (f === 'torneo') ir({ torneo: ev.target.value });
    });
    vista.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-seg="cat"]');
      if (b) ir({ cat: b.dataset.valor });
    });
  }

  return { titulo: 'Planteles', seccion: 'planteles', render, montar };
})();
