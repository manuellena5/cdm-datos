// Ficha de jugador (#/jugador/:id) — Fase 6.
// Con lo que hay: goles por torneo y categoría, partidos con formación, tarjetas y años en que aparece.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.jugador = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  const num = (v) => Number(v || 0);

  function rangos(anios) {
    const a = [...new Set(anios)].sort((x, y) => x - y);
    const partes = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      partes.push(i === j ? String(a[i]) : a[i] + '–' + a[j]);
      i = j;
    }
    return partes.join(', ');
  }

  function rol(p) {
    if (p.rol === 'Titular') return 'Titular' + (p.capitan ? ' (C)' : '');
    if (p.rol === 'Suplente que entró') return 'Entró' + (p.minuto_entra != null ? ' ' + p.minuto_entra + "'" : '');
    if (p.rol === 'Convocado (suplente)') return 'Convocado';
    if (p.rol === 'Suplente sin jugar') return 'No entró';
    return '';
  }

  async function render(params) {
    const [j, partidos, plantel] = await Promise.all([
      CDM.api.jugador(params.id), CDM.api.jugadorPartidos(params.id), CDM.api.plantel()
    ]);
    if (!j) {
      return '<section class="tarjeta vacio"><h2 class="vacio__titulo">No encontramos este jugador</h2>' +
        '<p><a href="#/goleadores">Ir a goleadores</a></p></section>';
    }
    const filas = plantel.filter((x) => x.jugador_id === j.jugador_id).sort((a, b) => b.torneo_orden - a.torneo_orden || a.categoria.localeCompare(b.categoria));
    const tot = filas.reduce((s, x) => {
      ['partidos', 'titular', 'goles', 'amarillas', 'rojas', 'presencias'].forEach((k) => { s[k] += num(x[k]); });
      return s;
    }, { partidos: 0, titular: 0, goles: 0, amarillas: 0, rojas: 0, presencias: 0 });
    const conFormacion = partidos.filter((p) => p.rol).length;
    const nombreCompleto = (j.nombre ? j.nombre + ' ' : '') + j.apellido;
    const dato = (k, v) => '<div class="dato"><div class="dato__k">' + k + '</div><div class="dato__v">' + v + '</div></div>';
    const linea = [j.apodo ? '"' + j.apodo + '"' : '', j.posicion, j.division ? (j.division === 'Ambas' ? 'Primera y Reserva' : j.division) : '',
      filas.length ? rangos(filas.map((x) => x.anio)) : ''].filter(Boolean).join(' · ');

    const filasMovil = filas.map((x, i) => CDM.filas.fila({
      href: CDM.router.armar('/planteles', { anio: x.anio, torneo: filtros.sufijo(x.torneo_id), cat: x.categoria === 'Reserva' ? 'R' : 'P' }),
      arriba: '<span class="fila__nombre fila__nombre--corto">' + e(x.torneo) + '</span><span class="fila__dato">' + e(x.categoria) + '</span>',
      abajo: CDM.filas.chips([
        num(x.partidos) ? ui.plural(num(x.partidos), 'jugado', 'jugados') : '',
        num(x.titular) ? num(x.titular) + ' de titular' : '',
        num(x.goles) ? ui.plural(num(x.goles), 'gol', 'goles') : '',
        num(x.amarillas) ? ui.plural(num(x.amarillas), 'amarilla', 'amarillas') : '',
        num(x.rojas) ? ui.plural(num(x.rojas), 'roja', 'rojas') : ''
      ]),
      claves: { reciente: filas.length - i, pj: num(x.partidos), goles: num(x.goles) }
    }));
    const tabla = filas.length
      ? CDM.filas.bloque({
        id: 'ficha-torneos', titulo: 'Por torneo', filas: filasMovil,
        ordenes: [{ valor: 'reciente', texto: 'Más recientes' }, { valor: 'pj', texto: 'Partidos' }, { valor: 'goles', texto: 'Goles' }],
        tabla: '<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Torneo</th><th>Cat.</th><th class="centro" title="Partidos jugados">PJ</th>' +
        '<th class="centro" title="Titular">Tit.</th><th class="centro">Goles</th><th class="centro" title="Amarillas">Am.</th><th class="centro">Rojas</th></tr></thead><tbody>' +
        filas.map((x) => '<tr><th scope="row"><a href="' + CDM.router.armar('/planteles', { anio: x.anio, torneo: filtros.sufijo(x.torneo_id), cat: x.categoria === 'Reserva' ? 'R' : 'P' }) + '">' +
          e(x.torneo) + '</a></th><td>' + e(x.categoria) + '</td><td class="centro">' + num(x.partidos) + '</td><td class="centro">' + num(x.titular) + '</td>' +
          '<td class="total centro">' + num(x.goles) + '</td><td class="centro">' + num(x.amarillas) + '</td><td class="centro">' + num(x.rojas) + '</td></tr>').join('') +
        '</tbody></table></div>'
      })
      : ui.vacio('Todavía no hay partidos cargados de este jugador.');

    const lista = partidos.map((p) => {
      const extra = [rol(p), num(p.goles) ? ui.plural(num(p.goles), 'gol', 'goles') : '', num(p.amarillas) ? 'amarilla' : '', num(p.rojas) ? 'roja' : '']
        .filter(Boolean).join(' · ');
      return '<li><a href="#/partido/' + encodeURIComponent(p.partido_id) + '"><span class="ficha-partido__k">' +
        e(ui.torneoSinAnio(p.torneo) + ' ' + p.anio + ' · ' + ui.instancia(p) + ' · ' + p.categoria) + '</span>' +
        '<span class="ficha-partido__rival">vs ' + e(p.rival) + (p.gf != null ? ' ' + p.gf + '-' + p.gc : '') + '</span>' +
        '<span class="ficha-partido__extra">' + e(extra) + '</span>' + ui.chipResultado(p.resultado) + '</a></li>';
    }).join('');

    return '<section class="ficha-cabeza"><h1 class="titulo-pantalla">' + e(nombreCompleto) + '</h1>' +
      (linea ? '<p class="texto-2">' + e(linea) + '</p>' : '') + '</section>' +
      '<section class="resumen" aria-label="Totales"><div class="resumen__pc resumen__ficha">' +
      dato('GOLES', tot.goles) + dato('PARTIDOS', tot.partidos) + dato('TITULAR', tot.titular) + dato('AMARILLAS', tot.amarillas) + dato('ROJAS', tot.rojas) +
      '</div></section>' +
      '<section class="tarjeta" aria-label="Por torneo"><h2 class="tarjeta__titulo">Por torneo</h2>' + tabla +
      '<p class="nota">PJ cuenta los partidos en que figura como titular o suplente que entró, o en que hizo un gol o tuvo una tarjeta. ' +
      (conFormacion ? 'Hay formación cargada en ' + ui.plural(conFormacion, 'partido suyo', 'partidos suyos') + '.' : 'Todavía no hay formaciones cargadas con este jugador.') + '</p></section>' +
      '<section class="tarjeta" aria-label="Partidos"><h2 class="tarjeta__titulo">Partidos (' + partidos.length + ')</h2>' +
      (lista ? '<ul class="ficha-partidos">' + lista + '</ul>' : ui.vacio('Sin partidos.')) + '</section>';
  }

  function montar(vista) {
    CDM.filas.montar(vista);
    const h1 = vista.querySelector('h1');
    if (h1) document.title = h1.textContent + ' · Historial Mitre';
  }

  return { titulo: 'Jugador', seccion: 'planteles', render, montar };
})();
