// Historial contra un rival (#/historial/rival/:id?cat=P&periodo=todo&ver=todos) — PLAN 6.6.2, mockup 12.
// Resultado, goles y condición salen de v_partidos (punto de vista del club propio); acá solo se suman.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.historialRival = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  const CATS = { P: 'Primera', R: 'Reserva', D: 'Las dos' };
  const VER = [['todos', 'Todos'], ['local', 'De local'], ['visitante', 'De visitante'], ['playoffs', 'Playoffs']];
  let actual = null;

  const esPlayoff = (p) => p.fase_orden > 0;
  const conMarcador = (p) => p.gf != null;
  const pct = (n) => Math.round(n) + '%';
  // '2026-08-09' → 'Dom 09/08'
  const dia = (iso) => {
    const larga = ui.fechaLarga(iso);
    return larga ? larga.charAt(0).toUpperCase() + larga.slice(1, 3) + ' ' + ui.fechaCorta(iso) : 'Sin fecha';
  };
  // 'Clausura 2025' + F4 → 'Clausura 25 · F4'
  const torneoCorto = (p) => ui.torneoSinAnio(p.torneo) + ' ' + String(p.anio).slice(2) + ' · ' + ui.instancia(p);
  // Primera y Reserva de un mismo partido comparten el ID salvo la letra final (-P / -R)
  const clavePartido = (p) => String(p.partido_id).replace(/-[PR]$/, '');

  function totales(lista) {
    const t = { pj: lista.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
    lista.forEach((p) => {
      t[{ G: 'g', E: 'e', P: 'p' }[p.resultado]]++;
      if (conMarcador(p)) { t.gf += p.gf; t.gc += p.gc; }
    });
    t.pts = t.g * 3 + t.e;
    t.efectividad = t.pj ? (100 * t.pts) / (3 * t.pj) : 0;
    return t;
  }

  // El más nuevo primero
  const ordenar = (lista) => lista.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
    b.torneo_orden - a.torneo_orden || (b.fase_orden - a.fase_orden) || (b.fecha_nro || 0) - (a.fecha_nro || 0) || a.categoria.localeCompare(b.categoria));

  const donde = (p) => (p.condicion === 'L' ? 'de local' : 'de visitante');

  // Mayor margen a favor (signo 1) o en contra (-1); entre iguales, el de más goles y después el más nuevo.
  function extremo(lista, signo) {
    const conMargen = ordenar(lista.filter((p) => conMarcador(p) && signo * (p.gf - p.gc) > 0));
    if (!conMargen.length) return null;
    return conMargen.reduce((m, p) => {
      const dm = signo * (m.gf - m.gc), dp = signo * (p.gf - p.gc);
      return dp > dm || (dp === dm && p.gf + p.gc > m.gf + m.gc) ? p : m;
    });
  }

  // Racha actual, del partido más nuevo hacia atrás.
  function racha(lista) {
    const orden = ordenar(lista);
    if (!orden.length) return null;
    const ultimo = orden[0].resultado;
    const sigue = { G: (r) => r === 'G', E: (r) => r !== 'P', P: (r) => r !== 'G' }[ultimo];
    let n = 0;
    while (n < orden.length && sigue(orden[n].resultado)) n++;
    const desde = orden[n - 1];
    let texto;
    if (ultimo === 'G') texto = n === 1 ? 'Ganó el último' : n + ' triunfos seguidos';
    else if (ultimo === 'E') texto = n === 1 ? 'Empató el último' : n + ' partidos sin perder';
    else if (orden.slice(0, n).every((p) => p.resultado === 'P')) texto = n === 1 ? 'Perdió el último' : n + ' derrotas seguidas';
    else texto = n + ' partidos sin ganar';
    return { texto, desde: n > 1 ? 'desde ' + torneoCorto(desde) : torneoCorto(desde) };
  }

  function goleadores(goles, partidosIds) {
    const cuenta = new Map();
    goles.filter((g) => g.lado === 'propio' && g.tipo !== 'En contra' && partidosIds.has(g.partido_id) && g.autor !== 'Sin dato').forEach((g) => {
      const k = g.jugador_id || g.autor;
      const x = cuenta.get(k) || { autor: g.autor, jugador_id: g.jugador_id, n: 0 };
      x.n++;
      cuenta.set(k, x);
    });
    return [...cuenta.values()].sort((a, b) => b.n - a.n || a.autor.localeCompare(b.autor, 'es')).slice(0, 3);
  }

  // ---------- Partes de la pantalla ----------
  function cabecera(propio, rival, equipos, base, cat) {
    const anios = base.map((p) => p.anio);
    const rango = anios.length ? (Math.min(...anios) === Math.max(...anios) ? String(anios[0]) : Math.min(...anios) + '–' + Math.max(...anios)) : '';
    const fases = base.some(esPlayoff) ? (base.some((p) => !esPlayoff(p)) ? 'liga y playoffs' : 'playoffs') : 'liga';
    return '<div class="rival-cabeza">' + ui.escudo(propio, 56) +
      '<div class="rival-cabeza__texto"><h1 class="rival-cabeza__titulo">' + e(propio.nombre_corto) + ' vs ' + e(rival.nombre_corto) + '</h1>' +
      '<p class="texto-2">' + e([CATS[cat], rango, base.length ? fases : ''].filter(Boolean).join(' · ')) + '</p></div>' +
      ui.escudo(equipos[rival.equipo_id], 56) + '</div>';
  }

  function resumen(t) {
    const tile = (k, v, clase) => '<div class="dato' + (clase ? ' ' + clase : '') + '"><div class="dato__k">' + k + '</div><div class="dato__v">' + v + '</div></div>';
    const ancho = (n) => (t.pj ? (100 * n) / t.pj : 0).toFixed(1) + '%';
    return '<section class="rival-resumen" aria-label="Resumen">' +
      '<div class="rival-resumen__datos">' + tile('PARTIDOS', t.pj) + tile('GANADOS', t.g) + tile('EMPATADOS', t.e) + tile('PERDIDOS', t.p) +
      tile('GOLES A FAVOR', t.gf) + tile('GOLES EN CONTRA', t.gc) + tile('EFECTIVIDAD', pct(t.efectividad), 'dato--destacado') + '</div>' +
      (t.pj ? '<div class="barra-gep" role="img" aria-label="' + e(ui.plural(t.g, 'ganado', 'ganados') + ', ' + ui.plural(t.e, 'empatado', 'empatados') + ', ' +
        ui.plural(t.p, 'perdido', 'perdidos')) + '"><span class="barra-gep__g" style="width:' + ancho(t.g) + '"></span>' +
        '<span class="barra-gep__e" style="width:' + ancho(t.e) + '"></span><span class="barra-gep__p" style="width:' + ancho(t.p) + '"></span></div>' : '') +
      '</section>';
  }

  function porCondicion(base, propio) {
    const caja = (titulo, lista) => {
      const t = totales(lista);
      return '<div class="tarjeta rival-cond"><h2 class="rival-cond__titulo">' + e(titulo) + '</h2>' +
        (t.pj ? '<p class="rival-cond__pj"><strong>' + t.pj + '</strong> PJ</p><p>' + t.g + ' G · ' + t.e + ' E · ' + t.p + ' P</p>' +
          '<p>Goles ' + t.gf + '–' + t.gc + '</p><p class="texto-2">' + pct(t.efectividad) + ' de los puntos</p>'
          : '<p class="texto-2">Sin partidos</p>') + '</div>';
    };
    return '<section class="rival-conds" aria-label="Local, visitante y playoffs">' +
      caja('De local' + (propio.cancha ? ' en ' + propio.cancha : ''), base.filter((p) => p.condicion === 'L')) +
      caja('De visitante', base.filter((p) => p.condicion === 'V')) +
      caja('Playoffs', base.filter(esPlayoff)) + '</section>';
  }

  function destacados(base, goles, rival) {
    const caja = (titulo, valor, texto, clase) => '<div class="tarjeta destacado"><div class="destacado__k">' + e(titulo) +
      '</div><div class="destacado__v' + (clase ? ' ' + clase : '') + '">' + valor + '</div><div class="destacado__t">' + texto + '</div></div>';
    const mejor = extremo(base, 1);
    const peor = extremo(base, -1);
    const r = racha(base);
    const primero = ordenar(base)[base.length - 1];
    const top = goleadores(goles, new Set(base.map((p) => p.partido_id)));
    const marcador = (p) => p.gf + ' – ' + p.gc;
    const nombreGol = (g) => (g.jugador_id ? '<a href="#/jugador/' + encodeURIComponent(g.jugador_id) + '">' + e(g.autor) + '</a>' : e(g.autor)) + ' ' + g.n;
    return '<section class="destacados" aria-label="Datos destacados">' +
      caja('MAYOR GOLEADA', mejor ? marcador(mejor) : '–', mejor ? e(torneoCorto(mejor) + ' · ' + donde(mejor)) : 'Sin victorias con marcador') +
      caja('PEOR DERROTA', peor ? marcador(peor) : '–', peor ? e(torneoCorto(peor) + ' · ' + donde(peor)) : 'Sin derrotas con marcador', 'destacado__v--derrota') +
      caja('RACHA ACTUAL', r ? e(r.texto) : '–', r ? e(r.desde) : '') +
      caja('PRIMER PARTIDO', primero ? (conMarcador(primero) ? marcador(primero) : e({ G: 'Ganó', E: 'Empató', P: 'Perdió' }[primero.resultado])) : '–',
        primero ? e(torneoCorto(primero) + ' · ' + (primero.condicion === 'L' ? 'de local' : 'de visitante')) : '') +
      caja('GOLEADORES DE MITRE', top.length ? '<span class="destacado__lider">' + nombreGol(top[0]) + '</span>' : '–',
        top.length > 1 ? top.slice(1).map(nombreGol).join(' · ') : (top.length ? '' : 'Sin goleadores cargados contra ' + e(rival.nombre_corto))) +
      '</section>';
  }

  // Una línea de partido: equipos con el club propio en negrita, marcador, etiqueta y goleadores.
  function lineaPartido(p, conCategoria, admin) {
    const local = p.condicion === 'L';
    const nom = (texto, propio) => (propio ? '<strong>' + e(texto) + '</strong>' : e(texto));
    const marc = conMarcador(p) ? p.goles_local + ' – ' + p.goles_visitante : 'sin marcador';
    const pen = ui.penales(p);
    const goles = !conMarcador(p) ? 'Resultado sin marcador' : p.gf === 0 ? 'Sin goles de Mitre'
      : p.goles_mitre_texto ? 'Goles: ' + p.goles_mitre_texto : 'Goleadores sin cargar';
    return '<div class="rival-partido__linea">' +
      (conCategoria ? '<span class="rival-partido__cat">' + e(p.categoria) + '</span>' : '') +
      '<span class="rival-partido__equipos">' + nom(p.local, local) + ' <span class="rival-partido__marcador">' + e(marc) + '</span> ' + nom(p.visitante, !local) + '</span>' +
      ui.chipResultado(p.resultado) + (pen ? '<span class="texto-2">' + e(pen) + '</span>' : '') +
      (admin && p.publicado === false ? '<span class="etiqueta etiqueta--info">Borrador</span>' : '') +
      '<span class="rival-partido__goles texto-2">' + e(goles) + '</span></div>';
  }

  function listaPartidos(base, cat, ver, admin) {
    const filtro = { todos: () => true, local: (p) => p.condicion === 'L', visitante: (p) => p.condicion === 'V', playoffs: esPlayoff }[ver];
    const visibles = ordenar(base.filter(filtro));
    // Con "Las dos", Primera y Reserva del mismo partido van juntas
    const grupos = [];
    visibles.forEach((p) => {
      const g = cat === 'D' && grupos.find((x) => x.clave === clavePartido(p));
      if (g) g.partidos.push(p);
      else grupos.push({ clave: clavePartido(p), partidos: [p] });
    });
    grupos.forEach((g) => g.partidos.sort((a, b) => a.categoria.localeCompare(b.categoria)));   // Primera primero
    let anio = null;
    let html = '';
    grupos.forEach((g) => {
      const p = g.partidos[0];
      if (p.anio !== anio) { html += (anio != null ? '</ul>' : '') + '<h3 class="rival-anio">' + p.anio + '</h3><ul class="rival-partidos">'; anio = p.anio; }
      html += '<li><a class="rival-partido" href="#/partido/' + encodeURIComponent(p.partido_id) + '" aria-label="' +
        e(torneoCorto(p) + ', ' + p.local + ' ' + (conMarcador(p) ? p.goles_local + ' a ' + p.goles_visitante : '') + ' ' + p.visitante + '. Ver detalle') + '">' +
        '<span class="rival-partido__cuando"><span class="rival-partido__torneo">' + e(torneoCorto(p)) + '</span>' +
        '<span class="texto-2">' + e(dia(p.fecha) + ' · ' + (p.condicion === 'L' ? 'Local' : 'Visitante')) + '</span></span>' +
        '<span class="rival-partido__lineas">' + g.partidos.map((x) => lineaPartido(x, cat === 'D', admin)).join('') + '</span>' +
        '<span class="rival-partido__ver" aria-hidden="true">Ver detalle ›</span></a></li>';
    });
    if (anio != null) html += '</ul>';
    return '<section class="tarjeta" aria-label="Todos los partidos"><div class="tarjeta__cabeza"><h2 class="tarjeta__titulo">Todos los partidos</h2>' +
      ui.segmentado('ver', 'Mostrar', VER.map(([valor, texto]) => ({ valor, texto })), ver) + '</div>' +
      (html || ui.vacio('No hay partidos con este filtro.')) + '</section>';
  }

  async function render(params, query) {
    // En modo administrador también se ven los borradores
    let admin = null;
    try { admin = (await CDM.api.sesion()) ? await CDM.api.administrador() : null; } catch (err) { admin = null; }
    const [partidos, listaEquipos] = await Promise.all([admin ? CDM.api.admin.partidos() : CDM.api.partidos(), CDM.api.equipos()]);
    const equipos = Object.fromEntries(listaEquipos.map((x) => [x.equipo_id, x]));
    const propio = listaEquipos.find((x) => x.es_propio) || { nombre_corto: 'Mitre' };
    const conResultado = partidos.filter((p) => p.resultado);

    // Rivales con partidos, para el selector
    const rivales = [...new Map(conResultado.map((p) => [p.rival_id, p.rival])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'));
    const rivalId = params.id;
    const rival = equipos[rivalId];
    if (!rival || !rivales.some(([id]) => id === rivalId)) {
      return '<section class="tarjeta vacio"><h2 class="vacio__titulo">No encontramos partidos contra ese rival</h2>' +
        '<p><a href="#/historial">Volver al historial</a></p></section>';
    }
    const cat = ['P', 'R', 'D'].includes(query.get('cat')) ? query.get('cat') : 'P';
    const contraRival = conResultado.filter((p) => p.rival_id === rivalId && (cat === 'D' || p.categoria === CATS[cat]));
    const anios = [...new Set(contraRival.map((p) => p.anio))].sort((a, b) => b - a);
    let periodo = query.get('periodo') === 'todo' || !query.get('periodo') ? 'todo' : Number(query.get('periodo'));
    if (periodo !== 'todo' && !anios.includes(periodo)) periodo = 'todo';
    const ver = VER.some(([v]) => v === query.get('ver')) ? query.get('ver') : 'todos';
    actual = { rival: rivalId, cat, periodo, ver };

    const base = contraRival.filter((p) => periodo === 'todo' || p.anio === periodo);
    const goles = base.length ? await CDM.api.golesDe(base.map((p) => p.partido_id)).catch(() => []) : [];
    const rango = anios.length ? (anios.length === 1 ? String(anios[0]) : anios[anios.length - 1] + '–' + anios[0]) : '';
    const inferidos = base.filter((p) => !conMarcador(p)).length;

    const controles = '<nav class="migas" aria-label="Ubicación"><a href="' + CDM.router.armar('/historial', { cat: cat === 'R' ? 'R' : 'P', periodo: 'todo' }) +
      '">Historial</a> › <span>Contra ' + e(rival.nombre_corto) + '</span></nav>' +
      '<section class="filtros" aria-label="Filtros">' +
      ui.selector('rival', 'Rival', rivales.map(([id, nombre]) => ({ valor: id, texto: nombre })), rivalId) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }, { valor: 'D', texto: 'Las dos' }], cat) +
      ui.selector('periodo', 'Período', [{ valor: 'todo', texto: 'Todo' + (rango ? ' (' + rango + ')' : '') }]
        .concat(anios.map((a) => ({ valor: a, texto: a }))), periodo) + '</section>';

    if (!base.length) {
      return controles + '<section class="tarjeta">' + cabecera(propio, rival, equipos, base, cat) +
        ui.vacio('No hay partidos contra ' + rival.nombre_corto + ' en ' + (CATS[cat] === 'Las dos' ? 'este período' : CATS[cat] + ' en este período') + '.') + '</section>';
    }
    return controles +
      '<section class="tarjeta rival-tarjeta">' + cabecera(propio, rival, equipos, base, cat) + resumen(totales(base)) + '</section>' +
      porCondicion(base, propio) + destacados(base, goles, rival) + listaPartidos(base, cat, ver, admin) +
      (inferidos ? '<p class="nota">' + ui.plural(inferidos, 'partido tiene', 'partidos tienen') +
        ' resultado sin marcador: cuentan en partidos y en ganados, empatados o perdidos, pero no en los goles.</p>' : '');
  }

  function montar(vista) {
    const ir = (cambios) => {
      const s = Object.assign({}, actual, cambios);
      CDM.router.cambiarFiltros('/historial/rival/' + encodeURIComponent(s.rival), { cat: s.cat, periodo: s.periodo, ver: s.ver === 'todos' ? undefined : s.ver });
    };
    vista.addEventListener('change', (ev) => {
      const f = ev.target.dataset.filtro;
      if (f === 'rival') ir({ rival: ev.target.value, periodo: 'todo', ver: 'todos' });
      if (f === 'periodo') ir({ periodo: ev.target.value });
    });
    vista.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-seg]');
      if (b && b.dataset.seg === 'cat') ir({ cat: b.dataset.valor });
      if (b && b.dataset.seg === 'ver') ir({ ver: b.dataset.valor });
    });
  }

  return { titulo: 'Historial contra un rival', seccion: 'historial', render, montar };
})();
