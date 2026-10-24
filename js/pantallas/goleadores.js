// Goleadores (#/goleadores?anio=2026&torneo=todo) — mockup Goleadores.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.goleadores = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  let actual = null;

  // 'Apertura' → 'Ap.', 'Clausura' → 'Cl.'
  const abreviar = (nombre) => nombre.slice(0, 2) + '.';

  // Resuelve los filtros: anio = número o 'todos'; torneo = letra o 'todo'.
  function elegir(campanas, query) {
    const anios = filtros.anios(campanas);
    let anio = query.get('anio') === 'todos' ? 'todos' : Number(query.get('anio'));
    if (anio !== 'todos' && !anios.includes(anio)) anio = anios[0];
    const lista = filtros.torneos(campanas).filter((t) => anio === 'todos' || t.anio === anio);
    // Tipos de torneo (por letra) presentes, en orden: Apertura, Clausura, copas…
    const tipos = [];
    lista.slice().sort((a, b) => (a.orden % 10) - (b.orden % 10)).forEach((t) => {
      if (!tipos.some((x) => x.letra === t.letra)) {
        tipos.push({ letra: t.letra, nombre: t.tipo === 'Copa' && anio !== 'todos' ? t.nombre : ui.torneoSinAnio(t.nombre) });
      }
    });
    let torneo = query.get('torneo') || 'todo';
    if (torneo !== 'todo' && !tipos.some((x) => x.letra === torneo)) torneo = 'todo';
    return { anio, torneo, tipos, columnas: torneo === 'todo' && tipos.length > 1 ? tipos : [] };
  }

  function nombreDePila(j) {
    const pila = (j.nombre || '').trim().split(/\s+/)[0];
    return (pila ? pila + ' ' : '') + j.apellido;
  }

  // Suma por jugador dentro de la selección.
  function tabla(filas, columnas) {
    const porJugador = new Map();
    filas.forEach((g) => {
      if (!porJugador.has(g.jugador_id)) {
        porJugador.set(g.jugador_id, { jugador_id: g.jugador_id, jugador: g.jugador, apellido: g.apellido, nombre: g.nombre, total: 0, por: {} });
      }
      const j = porJugador.get(g.jugador_id);
      j.total += g.goles;
      const letra = filtros.sufijo(g.torneo_id);
      j.por[letra] = (j.por[letra] || 0) + g.goles;
    });
    const lista = [...porJugador.values()].sort((a, b) => b.total - a.total || a.jugador.localeCompare(b.jugador, 'es'));
    lista.forEach((j) => { j.puesto = 1 + lista.filter((x) => x.total > j.total).length; });
    return lista;
  }

  function destacado(cat, lista, sel, liga, primero) {
    const etiqueta = 'GOLEADOR ' + cat.toUpperCase() + ' · ' +
      (sel.anio === 'todos' ? 'TODOS LOS AÑOS' : (sel.torneo !== 'todo' ? sel.tipos.find((t) => t.letra === sel.torneo).nombre.toUpperCase() + ' ' : '') + sel.anio);
    if (!lista.length) {
      return '<div class="lider' + (primero ? ' lider--azul' : '') + '"><div class="lider__n">0</div><div>' +
        '<div class="lider__k">' + e(etiqueta) + '</div><div class="lider__nombre">Sin goles cargados</div></div></div>';
    }
    const max = lista[0].total;
    const lideres = lista.filter((j) => j.total === max);
    let detalle = '';
    if (lideres.length === 1 && sel.columnas.length) {
      const j = lideres[0];
      const partes = sel.columnas.filter((t) => j.por[t.letra]);
      detalle = partes.length === 1 ? 'Todos en el ' + partes[0].nombre
        : partes.map((t) => j.por[t.letra] + ' en ' + t.nombre).join(' · ');
    }
    if (lideres.length === 1) {
      const conPuesto = liga.filter((l) => l.jugador_id === lideres[0].jugador_id && l.puesto);
      if (conPuesto.length === 1) detalle = [detalle, conPuesto[0].puesto + '° de la Liga'].filter(Boolean).join(' · ');
    }
    return '<div class="lider' + (primero ? ' lider--azul' : '') + '"><div class="lider__n">' + max + '</div><div>' +
      '<div class="lider__k">' + e(etiqueta) + '</div><div class="lider__nombre">' + e(ui.unir(lideres.map(nombreDePila))) + '</div>' +
      (detalle ? '<div class="lider__det">' + e(detalle) + '</div>' : '') + '</div></div>';
  }

  function tablaHtml(cat, lista, sel, extra) {
    const total = lista.reduce((s, j) => s + j.total, 0);
    const max = lista.length ? lista[0].total : 1;
    const cols = sel.columnas;
    const notas = [];
    if (extra.enContra) notas.push('+ ' + ui.plural(extra.enContra, 'gol en contra de rivales', 'goles en contra de rivales'));
    if (extra.sinAutor) notas.push('+ ' + ui.plural(extra.sinAutor, 'gol sin autor conocido', 'goles sin autor conocido'));
    const filas = lista.map((j) => '<tr><td class="num-chico">' + j.puesto + '</td><td><div class="goleador__nombre"><a href="#/jugador/' + encodeURIComponent(j.jugador_id) + '">' +
      e(j.jugador) + '</a></div><div class="barra"><div style="width:' + Math.round(j.total / max * 100) + '%"></div></div></td>' +
      cols.map((t) => '<td class="centro texto-2">' + (j.por[t.letra] || '–') + '</td>').join('') +
      '<td class="total">' + j.total + '</td></tr>').join('');
    return '<section class="tarjeta" aria-label="Goleadores ' + e(cat) + '"><h2 class="tarjeta__titulo">' +
      e(cat + ' · ' + ui.plural(total, 'gol', 'goles')) + '</h2>' +
      (lista.length
        ? '<div class="tabla-scroll"><table class="tabla tabla--goleadores"><thead><tr><th class="num-chico">#</th><th>Jugador</th>' +
          cols.map((t) => '<th class="centro" title="' + e(t.nombre) + '">' + e(abreviar(t.nombre)) + '</th>').join('') +
          '<th class="derecha">Total</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : ui.vacio('Todavía no hay goles cargados.')) +
      (notas.length ? '<p class="nota">' + e(notas.join(' · ')) + '</p>' : '') + '</section>';
  }

  async function render(params, query) {
    const [goleadores, campanas, liga] = await Promise.all([
      CDM.api.goleadores(), CDM.api.campanas(), CDM.api.goleadoresLiga()
    ]);
    const sel = elegir(campanas, query);
    actual = { anio: sel.anio, torneo: sel.torneo };
    const enSel = (x) => (sel.anio === 'todos' || x.anio === sel.anio) &&
      (sel.torneo === 'todo' || filtros.sufijo(x.torneo_id) === sel.torneo);
    const torneosSel = new Set(filtros.torneos(campanas).filter(enSel).map((t) => t.id));

    const controles = '<section class="filtros" aria-label="Filtros">' +
      ui.selector('anio', 'Año', filtros.anios(campanas).map((a) => ({ valor: a, texto: a }))
        .concat([{ valor: 'todos', texto: 'Todos' }]), sel.anio) +
      ui.selector('torneo', 'Torneo', [{ valor: 'todo', texto: sel.anio === 'todos' ? 'Todos los torneos' : 'Todo el año' }]
        .concat(sel.tipos.map((t) => ({ valor: t.letra, texto: t.nombre }))), sel.torneo) +
      '<p class="filtros__nota">Incluye playoffs · no cuenta goles en contra</p></section>';

    const bloques = ['Primera', 'Reserva'].map((cat) => {
      const lista = tabla(goleadores.filter((g) => g.categoria === cat && enSel(g)), sel.columnas);
      const camp = campanas.filter((c) => c.categoria === cat && enSel(c));
      const extra = {
        enContra: camp.reduce((s, c) => s + (c.goles_en_contra_a_favor || 0), 0),
        sinAutor: camp.reduce((s, c) => s + (c.goles_sin_autor || 0), 0)
      };
      const ligaCat = liga.filter((l) => l.categoria === cat && torneosSel.has(l.torneo_id));
      return { cat, lista, extra, ligaCat };
    });

    return controles +
      '<section class="lideres" aria-label="Máximos goleadores">' +
      bloques.map((b, i) => destacado(b.cat, b.lista, sel, b.ligaCat, i === 0)).join('') + '</section>' +
      '<div class="dos-columnas">' + bloques.map((b) => tablaHtml(b.cat, b.lista, sel, b.extra)).join('') + '</div>';
  }

  function montar(vista) {
    const ir = (cambios) => CDM.router.cambiarFiltros('/goleadores', Object.assign({}, actual, cambios));
    vista.addEventListener('change', (ev) => {
      const f = ev.target.dataset.filtro;
      if (f === 'anio') ir({ anio: ev.target.value, torneo: 'todo' });
      if (f === 'torneo') ir({ torneo: ev.target.value });
    });
  }

  return { titulo: 'Goleadores', seccion: 'goleadores', render, montar };
})();
