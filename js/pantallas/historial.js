// Historial (#/historial?cat=P&periodo=2026) — mockup Historial.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.historial = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  let actual = null;

  // "Cómo terminó" a partir de los datos de v_campanas.
  function comoTermino(c) {
    const partes = [];
    const regularCompleta = c.ultima_posicion != null && c.ultima_posicion_fecha >= c.pj && !c.programados;
    if (regularCompleta) partes.push(c.ultima_posicion + '°');
    if (c.zona) partes.push('Zona ' + c.zona);
    if (c.programados > 0) {
      partes.push('en curso · ' + (c.programados === 1 ? 'falta 1 fecha' : 'faltan ' + c.programados + ' fechas'));
    } else if (c.llego_a) {
      const fase = c.llego_a.toLowerCase();
      const pen = c.playoff_por_penales ? ' (pen.)' : '';
      if (c.llego_a === 'Final' && c.playoff_gano === true) partes.push('campeón' + pen);
      else if (c.llego_a === 'Final' && c.playoff_gano === false) partes.push('subcampeón' + pen);
      else if (c.playoff_gano === false) partes.push('eliminado en ' + fase + pen);
      else if (c.playoff_gano === true) partes.push('ganó ' + fase + pen);
      else partes.push('llegó a ' + fase);
    }
    if (!partes.length) return '–';
    const texto = partes.join(' · ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function campanas(lista, cat, cuerpos) {
    const categoria = filtros.nombreCategoria(cat);
    const tecnico = (c) => ui.cuerpoTecnico(cuerpos, c.torneo_id, categoria).tecnico;
    const hayTecnicos = lista.some((c) => tecnico(c));
    const filas = lista.slice().sort((a, b) => b.torneo_orden - a.torneo_orden).map((c) => {
      const href = CDM.router.armar('/resultados', { anio: c.anio, torneo: filtros.sufijo(c.torneo_id), cat });
      return '<tr><th scope="row"><a href="' + href + '">' + e(c.torneo) + '</a></th>' +
        ['pj', 'g', 'e', 'p', 'gf', 'gc'].map((k) => '<td class="centro">' + c[k] + '</td>').join('') +
        '<td class="total centro">' + c.pts + '</td><td class="texto-2">' + e(comoTermino(c)) + '</td>' +
        (hayTecnicos ? '<td class="texto-2">' + e(tecnico(c) || '–') + '</td>' : '') + '</tr>';
    }).join('');
    return '<section class="tarjeta" aria-label="Campañas por torneo"><h2 class="tarjeta__titulo">Campañas · ' +
      e(filtros.nombreCategoria(cat)) + '</h2>' +
      (filas
        ? '<div class="tabla-scroll"><table class="tabla tabla--ancha"><thead><tr><th>Torneo</th>' +
          ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'Pts'].map((k) => '<th class="centro">' + k + '</th>').join('') +
          '<th>Cómo terminó</th>' + (hayTecnicos ? '<th>Técnico</th>' : '') + '</tr></thead><tbody>' + filas + '</tbody></table></div>'
        : ui.vacio('Todavía no hay campañas cargadas.')) +
      '<p class="nota">Fase regular (con zonas e interzonales). Tocá un torneo para ver sus partidos.</p></section>';
  }

  // Mayor goleada / peor derrota: el mayor margen y, entre esos, el marcador con más goles.
  function extremo(partidos, signo) {
    const conMargen = partidos.filter((p) => signo * (p.gf - p.gc) > 0);
    if (!conMargen.length) return null;
    const margen = Math.max(...conMargen.map((p) => signo * (p.gf - p.gc)));
    const conEse = conMargen.filter((p) => signo * (p.gf - p.gc) === margen);
    const masGoles = Math.max(...conEse.map((p) => p.gf + p.gc));
    const iguales = conEse.filter((p) => p.gf + p.gc === masGoles);
    const veces = new Map();
    iguales.forEach((p) => veces.set(p.rival, (veces.get(p.rival) || 0) + 1));
    const rivales = [...veces].map(([r, n]) => r + (n > 1 ? ' (' + n + ' veces)' : ''));
    const p = iguales[0];
    const donde = iguales.length === 1 ? ' · ' + ui.torneoSinAnio(p.torneo) + ' ' + p.anio + ' ' + ui.instancia(p) : '';
    return { marcador: p.gf + ' - ' + p.gc, texto: 'vs ' + ui.unir(rivales) + donde };
  }

  function destacados(partidos, rivales, etiquetaPeriodo) {
    const caja = (titulo, valor, texto, clase) => '<div class="tarjeta destacado"><div class="destacado__k">' + e(titulo) +
      '</div><div class="destacado__v' + (clase ? ' ' + clase : '') + '">' + e(valor) + '</div><div class="destacado__t">' + e(texto) + '</div></div>';
    const mejor = extremo(partidos, 1);
    const peor = extremo(partidos, -1);
    const invictos = rivales.filter((r) => r.pj > 0 && r.p === 0).sort((a, b) => b.pj - a.pj || a.rival.localeCompare(b.rival, 'es'));
    return '<section class="destacados" aria-label="Datos destacados">' +
      caja('MAYOR GOLEADA A FAVOR · ' + etiquetaPeriodo, mejor ? mejor.marcador : '–', mejor ? mejor.texto : 'Sin victorias en el período') +
      caja('PEOR DERROTA · ' + etiquetaPeriodo, peor ? peor.marcador : '–', peor ? peor.texto : 'Sin derrotas en el período', 'destacado__v--derrota') +
      caja('SIN PERDER CONTRA · ' + etiquetaPeriodo, ui.plural(invictos.length, 'rival', 'rivales'),
        invictos.length ? ui.unir(invictos.map((r) => r.rival)) : 'Perdió con todos los rivales del período') +
      '</section>';
  }

  function tablaRivales(rivales, cat, etiquetaPeriodo, equipos) {
    const filas = rivales.slice().sort((a, b) => Number(b.porcentaje_puntos) - Number(a.porcentaje_puntos) || b.pj - a.pj ||
      a.rival.localeCompare(b.rival, 'es')).map((r) => {
      const pct = Math.round(Number(r.porcentaje_puntos));
      return '<tr><th scope="row"><span class="con-escudo">' + ui.escudo(equipos[r.rival_id], 24) + e(r.rival) + '</span></th>' +
        ['pj', 'g', 'e', 'p', 'gf', 'gc'].map((k) => '<td class="centro">' + r[k] + '</td>').join('') +
        '<td class="total centro">' + r.pts + '</td><td><div class="rendimiento"><div class="barra"><div style="width:' + pct +
        '%"></div></div><span>' + pct + '%</span></div></td></tr>';
    }).join('');
    return '<section class="tarjeta" aria-label="Contra cada rival"><h2 class="tarjeta__titulo">Contra cada rival · ' +
      e(filtros.nombreCategoria(cat)) + ' · ' + e(etiquetaPeriodo.toLowerCase() === 'todo el historial' ? 'todo el historial' : etiquetaPeriodo) + '</h2>' +
      (filas
        ? '<div class="tabla-scroll"><table class="tabla tabla--ancha"><thead><tr><th>Rival</th>' +
          ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'Pts'].map((k) => '<th class="centro">' + k + '</th>').join('') +
          '<th>Rendimiento</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : ui.vacio('No hay partidos con resultado en este período.')) +
      '<p class="nota">Rendimiento = puntos obtenidos sobre puntos en juego. Incluye playoffs.</p></section>';
  }

  async function render(params, query) {
    const [listaCampanas, partidos, historial, listaEquipos, cuerpos] = await Promise.all([
      CDM.api.campanas(), CDM.api.partidos(), CDM.api.historialRival(), CDM.api.equipos(), CDM.api.cuerposTecnicos()
    ]);
    const equipos = Object.fromEntries(listaEquipos.map((x) => [x.equipo_id, x]));
    const cat = filtros.categoria(query);
    const categoria = filtros.nombreCategoria(cat);
    const anios = filtros.anios(listaCampanas);
    let periodo = query.get('periodo') === 'todo' ? 'todo' : Number(query.get('periodo'));
    if (periodo !== 'todo' && !anios.includes(periodo)) periodo = anios[0];
    actual = { cat, periodo };
    const etiquetaPeriodo = periodo === 'todo' ? 'TODO EL HISTORIAL' : String(periodo);

    const enPeriodo = (x) => periodo === 'todo' || x.anio === periodo;
    const jugados = partidos.filter((p) => p.categoria === categoria && enPeriodo(p) && p.resultado && p.gf != null);
    const rivales = historial.filter((r) => r.categoria === categoria && (periodo === 'todo' ? r.anio == null : r.anio === periodo));

    const controles = '<section class="filtros" aria-label="Filtros">' +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) +
      ui.selector('periodo', 'Período', anios.map((a) => ({ valor: a, texto: a }))
        .concat([{ valor: 'todo', texto: 'Todo el historial' }]), periodo) +
      '<p class="filtros__nota">El período aplica a los datos destacados y a la tabla de rivales</p></section>';

    return controles + campanas(listaCampanas.filter((c) => c.categoria === categoria), cat, cuerpos) +
      destacados(jugados, rivales, etiquetaPeriodo) + tablaRivales(rivales, cat, etiquetaPeriodo, equipos);
  }

  function montar(vista) {
    const ir = (cambios) => CDM.router.cambiarFiltros('/historial', Object.assign({}, actual, cambios));
    vista.addEventListener('change', (ev) => {
      if (ev.target.dataset.filtro === 'periodo') ir({ periodo: ev.target.value });
    });
    vista.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-seg="cat"]');
      if (b) ir({ cat: b.dataset.valor });
    });
  }

  return { titulo: 'Historial', seccion: 'historial', render, montar };
})();
