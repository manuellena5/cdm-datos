// Detalle del partido (#/partido/:id) — mockup Detalle.
// El id se usa para buscar el partido, nunca se muestra en pantalla.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.detalle = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;

  // La otra categoría del mismo partido: en fase regular, mismo torneo y fecha;
  // en playoff, misma instancia, serie y rival.
  function buscarPar(p, partidos) {
    return partidos.find((x) => x.partido_id !== p.partido_id && x.categoria !== p.categoria &&
      x.torneo_id === p.torneo_id && x.fase === p.fase && (x.serie || '') === (p.serie || '') &&
      (p.fase_orden === 0 ? (p.fecha_nro != null && x.fecha_nro === p.fecha_nro) : x.rival_id === p.rival_id));
  }

  function encabezado(p) {
    const local = p.condicion === 'L';
    const pen = ui.penales(p);
    const volver = CDM.router.armar('/resultados', {
      anio: p.anio, torneo: filtros.sufijo(p.torneo_id), cat: p.categoria === 'Reserva' ? 'R' : 'P'
    });
    return '<section class="marcador-grande" aria-label="Resultado">' +
      '<div class="marcador-grande__barra"><a href="' + volver + '" class="volver">' +
      '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
      'Volver a resultados</a><span>' + e(p.torneo + ' · ' + ui.instanciaLarga(p) + ' · ' + p.categoria) + '</span></div>' +
      '<div class="marcador-grande__cuerpo">' +
      '<div class="marcador-grande__eq marcador-grande__eq--local"><div class="marcador-grande__nombre' + (local ? ' es-propio' : '') + '">' +
      e(p.local) + '</div><div class="marcador-grande__cond">Local</div></div>' +
      '<div class="marcador-grande__score">' + e(ui.marcador(p)) + (pen ? '<small>' + e(pen) + '</small>' : '') + '</div>' +
      '<div class="marcador-grande__eq"><div class="marcador-grande__nombre' + (!local ? ' es-propio' : '') + '">' +
      e(p.visitante) + '</div><div class="marcador-grande__cond">Visitante</div></div>' +
      '</div></section>';
  }

  function datos(p, posiciones) {
    const pos = p.fase_orden === 0 && p.fecha_nro != null &&
      posiciones.find((x) => x.categoria === p.categoria && x.tras_fecha === p.fecha_nro && x.posicion != null);
    const item = (k, v) => '<div><div class="datos__k">' + k + '</div><div class="datos__v' + (v ? '' : ' datos__v--sin') + '">' +
      e(v || 'Sin dato') + '</div></div>';
    let estado = '';
    if (p.estado !== 'Jugado') estado = item('Estado', p.estado);
    return '<section class="tarjeta datos" aria-label="Datos del partido">' +
      item('Fecha', ui.fechaLarga(p.fecha) + (p.estado === 'Programado' && p.hora ? ' · ' + ui.hora(p.hora) : '')) +
      item('Estadio', p.cancha) + item('Árbitro', p.arbitro) +
      (pos ? item('Tabla después', pos.posicion + '° · ' + ui.plural(pos.pts, 'pt', 'pts')) : '') +
      estado + '</section>';
  }

  // Goles de una categoría: los del local a la izquierda y los del visitante a la derecha.
  function goles(p, lista) {
    const propios = lista.filter((g) => g.partido_id === p.partido_id);
    const enLocal = (g) => (g.lado === 'propio') === (p.condicion === 'L');
    const cuando = (g) => (g.minuto != null ? g.minuto + "'" : g.tiempo && g.tiempo !== 'Sin dato' ? g.tiempo : '');
    const extra = (g) => (g.tipo === 'Penal' ? ' (penal)' : g.tipo === 'Tiro libre' ? ' (tiro libre)' : '');
    const filas = propios.map((g) => {
      const texto = '<span class="gol__autor gol__autor--' + g.lado + '">' + e(g.autor + extra(g)) + '</span>';
      const t = cuando(g);
      const pildora = '<span class="gol__cuando gol__cuando--' + g.lado + (t ? '' : ' gol__cuando--vacio') + '">' + e(t) + '</span>';
      return enLocal(g)
        ? '<div class="gol"><div class="gol__izq">' + texto + '</div>' + pildora + '<div></div></div>'
        : '<div class="gol"><div></div>' + pildora + '<div class="gol__der">' + texto + '</div></div>';
    }).join('');
    const total = (p.goles_local || 0) + (p.goles_visitante || 0);
    let nota = '';
    if (p.goles_local == null) nota = ui.vacio(p.estado === 'Programado' ? 'Todavía no se jugó.' : 'No hay resultado cargado.');
    else if (total === 0) nota = '<p class="nota">Sin goles.</p>';
    else if (!propios.length) nota = ui.vacio('Todavía no hay goleadores cargados para este partido.');
    else if (propios.length < total) {
      const faltan = total - propios.length;
      nota = '<p class="nota">' + (faltan === 1 ? 'Falta cargar 1 goleador.' : 'Falta cargar ' + faltan + ' goleadores.') + '</p>';
    }
    return '<section class="tarjeta" aria-label="Goles ' + e(p.categoria) + '"><h2 class="tarjeta__titulo">' +
      e(p.categoria + (p.goles_local != null ? ' · ' + ui.marcador(p) : '')) +
      '</h2><div class="goles">' + filas + '</div>' + nota + '</section>';
  }

  function incidencias(lista, partidos, propio) {
    if (!lista.length) return '';
    const varias = new Set(lista.map((i) => i.categoria)).size > 1;
    const porId = Object.fromEntries(partidos.map((p) => [p.partido_id, p]));
    const items = lista.map((i) => {
      const equipo = i.lado === 'propio' ? propio.nombre_corto : i.lado === 'rival' ? porId[i.partido_id].rival : '';
      const quien = [i.quien, equipo && i.quien ? '(' + equipo + ')' : equipo].filter(Boolean).join(' ');
      return '<li class="incidencia">' + ui.icono(i.tipo) + '<div><div class="incidencia__titulo">' +
        (i.minuto != null ? '<span class="incidencia__min">' + i.minuto + "'</span> " : '') +
        e(i.tipo) + (quien ? ' · ' + e(quien) : '') + (varias ? ' <span class="incidencia__cat">' + e(i.categoria) + '</span>' : '') +
        '</div>' + (i.descripcion ? '<div class="incidencia__desc">' + e(i.descripcion) + '</div>' : '') + '</div></li>';
    }).join('');
    return '<section class="tarjeta" aria-label="Incidencias"><h2 class="tarjeta__titulo">Incidencias</h2>' +
      '<ul class="incidencias">' + items + '</ul></section>';
  }

  function formacion(lista, partidos) {
    const bloques = partidos.map((p) => {
      const de = lista.filter((f) => f.partido_id === p.partido_id);
      if (!de.length) return '';
      const nombre = (f) => e(f.jugador) + (f.capitan ? ' <span class="capitan" title="Capitán">C</span>' : '');
      const titulares = de.filter((f) => f.rol === 'Titular');
      const resto = de.filter((f) => f.rol !== 'Titular');
      return '<div class="formacion"><h3>' + e(p.categoria) + '</h3>' +
        '<ol class="formacion__titulares">' + titulares.map((f) => '<li>' + nombre(f) + '</li>').join('') + '</ol>' +
        (resto.length ? '<p class="formacion__resto"><strong>' +
          (resto.every((f) => f.rol === 'Convocado (suplente)') ? 'Convocados' : 'Suplentes') + ':</strong> ' +
          resto.map(nombre).join(', ') + '</p>' : '') + '</div>';
    }).join('');
    return '<section class="tarjeta" aria-label="Formación"><h2 class="tarjeta__titulo">Formación</h2>' +
      (bloques || ui.vacio('Todavía no hay formación cargada para este partido.')) + '</section>';
  }

  function contraRival(p, partidos, historial) {
    const h = historial.find((x) => x.rival_id === p.rival_id && x.categoria === p.categoria && x.anio == null);
    const cruces = partidos.filter((x) => x.rival_id === p.rival_id && x.categoria === p.categoria && x.resultado &&
      x.gf != null).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.torneo_orden - a.torneo_orden)
      .slice(0, 5);
    const n = (v, k) => '<div><div class="mini__v">' + (v ?? 0) + '</div><div class="mini__k">' + k + '</div></div>';
    const corto = (x) => ui.torneoSinAnio(x.torneo) + ' ' + String(x.anio).slice(2) + ' · ' + ui.instancia(x);
    return '<section class="tarjeta" aria-label="Historial contra el rival"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Contra ' +
      e(p.rival) + ' · ' + e(p.categoria) + '</h2>' +
      '<div class="mini">' + n(h && h.pj, 'PJ') + n(h && h.g, 'Ganados') + n(h && h.e, 'Empates') + n(h && h.p, 'Perdidos') + '</div>' +
      (cruces.length ? '<ul class="cruces">' + cruces.map((x) => '<li><a href="#/partido/' + encodeURIComponent(x.partido_id) + '"' +
        (x.partido_id === p.partido_id ? ' aria-current="page"' : '') + '><span>' + e(corto(x)) + '</span><span class="cruces__res">' +
        e(x.gf + ' - ' + x.gc) + ' ' + ui.chipResultado(x.resultado) + '</span></a></li>').join('') + '</ul>' : '') +
      '<a class="enlace" href="' + CDM.router.armar('/historial', { cat: p.categoria === 'Reserva' ? 'R' : 'P', periodo: 'todo' }) +
      '">Ver historial completo</a></section>';
  }

  function fuentes(lista, p) {
    const items = lista.map((f) => {
      const texto = f.medio + (f.que_cubre ? ' · ' + f.que_cubre : '');
      return '<li>' + (f.url ? '<a href="' + e(f.url) + '" target="_blank" rel="noopener noreferrer">' + e(texto) + '</a>' : e(texto)) + '</li>';
    }).join('');
    return '<section class="tarjeta" aria-label="Fuentes"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Fuentes</h2>' +
      (items ? '<ul class="fuentes">' + items + '</ul>' : '<p class="nota">Sin fuentes cargadas.</p>') +
      '<p class="nota">Completitud: ' + e(String(p.completitud).toLowerCase()) + '</p></section>';
  }

  async function render(params) {
    const [partidos, historial, propio] = await Promise.all([
      CDM.api.partidos(), CDM.api.historialRival(), CDM.api.clubPropio()
    ]);
    const p = partidos.find((x) => x.partido_id === params.id);
    if (!p) {
      return '<section class="tarjeta vacio"><h2 class="vacio__titulo">No encontramos este partido</h2>' +
        '<p><a href="#/resultados">Ir a resultados</a></p></section>';
    }
    const par = buscarPar(p, partidos);
    // Primera siempre primero
    const ambos = [p, par].filter(Boolean).sort((a, b) => a.categoria.localeCompare(b.categoria));
    const ids = ambos.map((x) => x.partido_id);
    const idsFuentes = [...new Set(ambos.flatMap((x) => x.fuente_ids || []))];
    const [listaGoles, listaInc, listaForm, posiciones, listaFuentes] = await Promise.all([
      CDM.api.golesDe(ids), CDM.api.incidenciasDe(ids), CDM.api.formacionesDe(ids), CDM.api.posicionesDe(p.torneo_id),
      idsFuentes.length ? CDM.api.fuentes(idsFuentes) : Promise.resolve([])
    ]);

    return encabezado(p) +
      '<div class="detalle">' +
      '<div class="detalle__principal">' + datos(p, posiciones) +
      ambos.map((x) => goles(x, listaGoles)).join('') +
      incidencias(listaInc, ambos, propio) + formacion(listaForm, ambos) + '</div>' +
      '<aside class="detalle__lateral">' + contraRival(p, partidos, historial) + fuentes(listaFuentes, p) + '</aside>' +
      '</div>';
  }

  function montar(vista) {
    const nombre = vista.querySelector('.marcador-grande__barra span');
    if (nombre) document.title = nombre.textContent + ' · Historial Mitre';
  }

  return { titulo: 'Partido', seccion: 'resultados', render, montar };
})();
