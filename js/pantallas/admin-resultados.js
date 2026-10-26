// Resultados en modo administrador (#/admin/resultados?anio=2011&torneo=C&cat=P&ver=falta) — PLAN 6.5.1, mockup 9.
// Todas las fechas de la fase regular, sin saltos: cada partido con lo que le falta y un lápiz para corregirlo,
// y cada fecha sin partido con "Cargar partido" y "Marcar libre". Incluye borradores y playoffs.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminResultados = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  let actual = null;   // filtros resueltos, para montar()

  const LAPIZ = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const FECHA_APROXIMADA = /fecha\s*(aproximada|=\s*d[ií]a de juego estimado|seg[uú]n (la )?publicaci[oó]n)/i;
  const etiqueta = (texto, tipo) => '<span class="etiqueta etiqueta--' + tipo + '">' + e(texto) + '</span>';
  const hoy = new Date().toISOString().slice(0, 10);

  // Lo que le falta a un partido. 'falta' cuenta como faltante; 'info' y 'ok' solo informan.
  function faltantes(p, otra, golesDe, conFormacion, esLiga) {
    const t = [];
    const g = golesDe[p.partido_id] || { propios: 0, rival: 0 };
    if (!p.publicado) t.push(['Borrador', 'falta']);
    if (p.estado === 'Programado' && p.fecha && p.fecha < hoy) t.push(['Programado vencido', 'falta']);
    else if (p.estado !== 'Programado' && !p.resultado) t.push(['Sin resultado', 'falta']);
    if (p.completitud === 'Inferido') t.push(['Resultado inferido', 'falta']);
    if (p.gf != null && g.propios < p.gf) {
      const n = p.gf - g.propios;
      t.push([n === 1 ? 'Falta 1 goleador de Mitre' : 'Faltan ' + n + ' goleadores de Mitre', 'falta']);
    }
    if (esLiga && p.fase_orden === 0 && !otra) t.push(['Falta ' + (p.categoria === 'Primera' ? 'Reserva' : 'Primera'), 'falta']);
    if (p.gc != null && g.rival < p.gc) {
      const n = p.gc - g.rival;
      t.push([n === 1 ? 'Falta 1 goleador del rival' : 'Faltan ' + n + ' goleadores del rival', 'info']);
    }
    if (p.estado !== 'Programado' && !p.arbitro) t.push(['Sin árbitro', 'info']);
    if (FECHA_APROXIMADA.test(p.observaciones || '')) t.push(['Fecha aproximada', 'info']);
    if (conFormacion.has(p.partido_id)) t.push(['Con formación', 'ok']);
    return t;
  }

  function tarjeta(p, otra, golesDe, conFormacion, esLiga, propioId) {
    const t = faltantes(p, otra, golesDe, conFormacion, esLiga);
    const conFalta = t.some(([, tipo]) => tipo === 'falta');
    const local = p.local_id === propioId;
    const equipo = (nombre, propio) => '<span' + (propio ? ' class="es-propio"' : '') + '>' + e(nombre) + '</span>';
    const otraTexto = otra ? ' · ' + otra.categoria + ' ' + (otra.goles_local != null ? otra.goles_local + '-' + otra.goles_visitante : ui.marcador(otra)) : '';
    const titulo = p.fase_orden === 0 ? 'Fecha ' + p.fecha_nro : ui.instancia(p);
    return '<li class="fecha-admin' + (conFalta ? ' fecha-admin--falta' : '') + '" data-falta="' + (conFalta ? 1 : 0) + '">' +
      '<div class="fecha-admin__nro"><div>' + e(titulo) + '</div><div class="texto-2">' + e(p.fecha ? ui.fechaLarga(p.fecha).replace(/\/\d{4}$/, '') : 'Sin fecha') + '</div></div>' +
      '<div class="fecha-admin__partido"><div class="fecha-admin__marcador">' + equipo(p.local, local) +
      '<span class="fecha-admin__score">' + e(ui.marcador(p)) + (ui.penales(p) ? ' <small>(' + e(ui.penales(p)) + ')</small>' : '') + '</span>' +
      equipo(p.visitante, !local) + ui.chipResultado(p.resultado, ui.tituloChip(p)) + '</div>' +
      '<div class="texto-2">Goles: ' + e(p.goles_mitre_texto || '—') + e(otraTexto) + '</div></div>' +
      '<div class="fecha-admin__etiquetas">' + t.map(([texto, tipo]) => etiqueta(texto, tipo)).join('') + '</div>' +
      '<a class="boton-icono" href="#/admin/partido/' + encodeURIComponent(p.partido_id) + '" aria-label="Editar ' + e(titulo + ' vs ' + p.rival) + '">' + LAPIZ + '</a></li>';
  }

  // Fecha sin partido de esta categoría: libre, posible libre (con el motivo) o pendiente.
  function sinPartido(n, sel, libre, indicio, otra) {
    const k = sel.torneo.id + '|' + n;
    if (libre) {
      const cuando = libre.creado_en ? ' el ' + ui.fechaCorta(libre.creado_en.slice(0, 10)) : '';
      return '<li class="fecha-admin fecha-admin--libre" data-falta="0"><div class="fecha-admin__nro"><div>Fecha ' + n + '</div></div>' +
        '<div class="fecha-admin__texto">' + e(sel.propio) + ' <strong>' + (libre.motivo === 'Libre' ? 'libre' : 'no jugó (fecha no jugada)') + '</strong>' +
        (libre.creado_por || cuando ? ' · marcado' + (libre.creado_por ? ' por ' + e(libre.creado_por) : '') + e(cuando) : '') + '</div>' +
        etiqueta(libre.motivo, 'info') +
        '<button type="button" class="boton boton--borde" data-deshacer="' + e(k) + '">Deshacer</button></li>';
    }
    const cargar = otra
      ? '#/admin/partido/' + encodeURIComponent(otra.partido_id) + '?incluir=' + sel.categoria
      : CDM.router.armar('/admin/partido/nuevo', { torneo: sel.torneo.id, instancia: 'F' + n });
    const texto = otra
      ? 'Está el partido de ' + otra.categoria + ' (vs ' + otra.rival + '); falta el de ' + sel.categoria + '.'
      : indicio || 'No hay partido cargado ni datos de esta fecha.';
    return '<li class="fecha-admin fecha-admin--sin" data-falta="1"><div class="fecha-admin__nro"><div>Fecha ' + n + '</div></div>' +
      '<div class="fecha-admin__texto">' + e(texto) + '</div>' +
      etiqueta(otra ? 'Falta ' + sel.categoria : indicio ? 'Posible libre' : 'Pendiente', 'falta') +
      '<div class="botones-chicos"><a class="boton" href="' + cargar + '">Cargar partido</a>' +
      (otra ? '' : '<button type="button" class="boton boton--borde" data-libre="' + e(k) + '">Marcar libre</button>' +
        '<button type="button" class="enlace-boton" data-nojugo="' + e(k) + '">No se jugó</button>') + '</div></li>';
  }

  // Indicios de que Mitre no jugó la fecha n: la tabla, una observación o que es la única fecha sin partido.
  function indicioLibre(n, sel, posiciones, partidosTorneo, faltanAmbas) {
    const tabla = posiciones.filter((x) => x.categoria === sel.categoria);
    const tras = tabla.find((x) => x.tras_fecha === n);
    const antes = tabla.find((x) => x.tras_fecha === n - 1);
    if (tras && antes && tras.pj != null && antes.pj != null && tras.pj === antes.pj) return 'No hay partido cargado. Por la tabla, Mitre no jugó esta fecha.';
    if (tras && antes && tras.pts === antes.pts) return 'No hay partido cargado. Por la tabla, Mitre no sumó puntos esta fecha.';
    const dice = new RegExp('fecha\\s*' + n + '\\s*:?\\s*mitre\\s+libre', 'i');
    if (partidosTorneo.some((p) => dice.test(p.observaciones || ''))) return 'No hay partido cargado. Las observaciones del torneo dicen que Mitre quedó libre.';
    if (faltanAmbas.length === 1 && faltanAmbas[0] === n) return 'No hay partido cargado. Es la única fecha sin partido del torneo.';
    return '';
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { actual = null; return acceso.html; }
    const api = CDM.api.admin;
    const [partidos, torneos, libres, conFormacionLista, campanas, equipos] = await Promise.all([
      api.partidos(), api.torneos(), api.fechasLibres(), api.partidosConFormacion(), CDM.api.campanas(), CDM.api.equipos()
    ]);
    // Los filtros salen de todos los torneos (también los que solo tienen borradores)
    const comoCampanas = torneos.map((t) => ({ torneo_id: t.torneo_id, anio: t.anio, torneo: t.nombre, torneo_tipo: t.tipo, torneo_orden: t.orden }));
    const elegido = filtros.elegirTorneo(comoCampanas, query);
    const letra = elegido.letra === 'todo' ? filtros.torneos(comoCampanas).filter((t) => t.anio === elegido.anio).pop().letra : elegido.letra;
    const torneo = filtros.torneos(comoCampanas).find((t) => t.anio === elegido.anio && t.letra === letra);
    const cat = filtros.categoria(query);
    const categoria = filtros.nombreCategoria(cat);
    const ver = query.get('ver') === 'falta' ? 'falta' : 'todas';
    const propio = equipos.find((x) => x.es_propio) || { equipo_id: '', nombre_corto: '' };
    const sel = { torneo, categoria, propio: propio.nombre_corto };
    actual = { anio: elegido.anio, torneo: letra, cat, ver: ver === 'falta' ? 'falta' : undefined };

    const datosTorneo = torneos.find((t) => t.torneo_id === torneo.id);
    const esLiga = datosTorneo.tipo === 'Liga';
    const delTorneo = partidos.filter((p) => p.torneo_id === torneo.id);
    const deCat = filtros.ordenarPartidos(delTorneo.filter((p) => p.categoria === categoria));
    const deOtra = delTorneo.filter((p) => p.categoria !== categoria);
    const regulares = deCat.filter((p) => p.fase_orden === 0 && p.fecha_nro);
    const otros = deCat.filter((p) => !(p.fase_orden === 0 && p.fecha_nro));
    const [goles, posiciones] = await Promise.all([
      deCat.length ? api.golesDe(deCat.map((p) => p.partido_id)) : Promise.resolve([]),
      CDM.api.posicionesDe(torneo.id)
    ]);
    const golesDe = {};
    goles.forEach((g) => {
      const x = golesDe[g.partido_id] || (golesDe[g.partido_id] = { propios: 0, rival: 0 });
      if (g.lado === 'rival') x.rival++;
      else if (g.jugador_id || g.tipo === 'En contra') x.propios++;
    });
    const conFormacion = new Set(conFormacionLista);
    const libresT = libres.filter((l) => l.torneo_id === torneo.id);
    const ultima = Math.max(0, ...delTorneo.filter((p) => p.fase_orden === 0).map((p) => p.fecha_nro || 0));
    const total = Math.max(datosTorneo.fechas_regular || 0, ultima);
    const faltanAmbas = [];
    for (let n = 1; n <= total; n++) {
      if (!delTorneo.some((p) => p.fase_orden === 0 && p.fecha_nro === n) && !libresT.some((l) => l.fecha_nro === n)) faltanAmbas.push(n);
    }

    const filas = [];
    let sinPartidoN = 0;
    for (let n = 1; n <= total; n++) {
      const p = regulares.find((x) => x.fecha_nro === n);
      const otra = deOtra.find((x) => x.fase_orden === 0 && x.fecha_nro === n);
      if (p) {
        filas.push(tarjeta(p, otra, golesDe, conFormacion, esLiga, propio.equipo_id));
      } else {
        const libre = libresT.find((l) => l.fecha_nro === n);
        if (!libre) sinPartidoN++;
        filas.push(sinPartido(n, sel, libre, libre || otra ? '' : indicioLibre(n, sel, posiciones, delTorneo, faltanAmbas), otra));
      }
    }
    const filasOtros = otros.map((p) => tarjeta(p, deOtra.find((x) => x.fase === p.fase && (x.serie || '') === (p.serie || '') && x.rival_id === p.rival_id),
      golesDe, conFormacion, false, propio.equipo_id));
    const conFaltas = deCat.filter((p) => faltantes(p, deOtra.find((x) => x.fase_orden === 0 && x.fecha_nro === p.fecha_nro), golesDe, conFormacion, esLiga && p.fase_orden === 0)
      .some(([, tipo]) => tipo === 'falta')).length;
    const c = campanas.find((x) => x.torneo_id === torneo.id && x.categoria === categoria);
    const aviso = CDM.admin.tomarAviso();

    const controles = '<section class="filtros" aria-label="Filtros">' +
      ui.selector('anio', 'Año', [...new Set(torneos.map((t) => t.anio))].sort((a, b) => b - a).map((a) => ({ valor: a, texto: a })), elegido.anio) +
      ui.selector('torneo', 'Torneo', filtros.opcionesTorneo(comoCampanas, elegido.anio).filter((o) => o.valor !== 'todo'), letra) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) +
      ui.segmentado('ver', 'Mostrar', [{ valor: 'todas', texto: 'Todas las fechas' }, { valor: 'falta', texto: 'Solo lo que falta' }], ver) + '</section>';

    const resumen = '<section class="tarjeta estado-torneo" aria-label="Estado del torneo">' +
      '<h2 class="estado-torneo__titulo">' + e(torneo.nombre + ' · ' + categoria) + '</h2>' +
      '<div><strong>' + total + '</strong> ' + (total === 1 ? 'fecha' : 'fechas') + '</div>' +
      '<div><strong>' + deCat.length + '</strong> ' + (deCat.length === 1 ? 'partido cargado' : 'partidos cargados') + '</div>' +
      '<div><strong>' + libresT.length + '</strong> ' + (libresT.length === 1 ? 'libre' : 'libres') + '</div>' +
      '<div class="' + (sinPartidoN ? 'texto-falta' : '') + '"><strong>' + sinPartidoN + '</strong> ' + (sinPartidoN === 1 ? 'fecha sin partido' : 'fechas sin partido') + '</div>' +
      '<div class="' + (conFaltas ? 'texto-falta' : '') + '"><strong>' + conFaltas + '</strong> ' + (conFaltas === 1 ? 'partido con datos que faltan' : 'partidos con datos que faltan') + '</div>' +
      (c ? '<div class="estado-torneo__pts">Pts <strong>' + c.pts + '</strong> · PJ ' + c.pj + ' · G ' + c.g + ' · E ' + c.e + ' · P ' + c.p + '</div>' : '') +
      '<form class="pendiente__fechas" data-form="fechas"><label for="fr">Fechas de la fase regular</label>' +
      '<input id="fr" name="n" type="number" inputmode="numeric" min="1" max="60" value="' + (datosTorneo.fechas_regular || '') + '" placeholder="' + (ultima || 'Sin dato') + '">' +
      '<button type="submit" class="boton boton--borde">Guardar</button></form></section>';

    return CDM.admin.barra('Resultados', acceso.admin, { actual: 'resultados' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      controles + '<p class="form-error" role="alert" hidden></p>' + resumen +
      '<ol class="fechas-admin' + (ver === 'falta' ? ' fechas-admin--solo-falta' : '') + '">' +
      (filas.length ? filas.join('') : '<li class="vacio vacio--chico">No hay fechas de fase regular cargadas para este torneo.</li>') + '</ol>' +
      '<section class="fechas-admin__despues" aria-label="Después de la fase regular"><h2 class="subtitulo">Después de la fase regular</h2>' +
      (filasOtros.length ? '<ol class="fechas-admin' + (ver === 'falta' ? ' fechas-admin--solo-falta' : '') + '">' + filasOtros.join('') + '</ol>'
        : '<p class="nota">No hay partidos de playoff cargados. Si Mitre jugó alguno, se agrega acá.</p>') +
      '<a class="boton boton--borde" href="' + CDM.router.armar('/admin/partido/nuevo', { torneo: torneo.id, instancia: 'Octavos' }) + '">+ Partido de playoff</a></section>';
  }

  function montar(vista) {
    CDM.admin.montarAcceso(vista);
    if (!actual) return;
    const ir = (cambios) => CDM.router.cambiarFiltros('/admin/resultados', Object.assign({}, actual, cambios));
    const error = (texto) => {
      const p = vista.querySelector('.form-error');
      p.textContent = texto;
      p.hidden = !texto;
      if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    vista.addEventListener('change', (ev) => {
      const f = ev.target.dataset.filtro;
      if (f === 'anio') ir({ anio: ev.target.value, torneo: undefined });
      if (f === 'torneo') ir({ torneo: ev.target.value });
    });
    vista.addEventListener('click', async (ev) => {
      const seg = ev.target.closest('[data-seg]');
      if (seg && seg.dataset.seg === 'cat') return ir({ cat: seg.dataset.valor });
      if (seg && seg.dataset.seg === 'ver') return ir({ ver: seg.dataset.valor === 'falta' ? 'falta' : undefined });
      const b = ev.target.closest('[data-libre], [data-nojugo], [data-deshacer]');
      if (!b) return;
      const [tid, n] = (b.dataset.libre || b.dataset.nojugo || b.dataset.deshacer).split('|');
      b.disabled = true;
      try {
        if (b.dataset.deshacer) {
          await CDM.api.admin.quitarLibre(tid, Number(n));
          CDM.admin.avisar('Fecha ' + n + ': vuelve a pendientes.');
        } else {
          await CDM.api.admin.marcarLibre(tid, Number(n), b.dataset.nojugo ? 'No se jugó' : 'Libre');
          CDM.admin.avisar('Fecha ' + n + (b.dataset.nojugo ? ': marcada como no jugada.' : ': Mitre quedó libre.'));
        }
        CDM.router.recargar();
      } catch (err) {
        b.disabled = false;
        error(err.message);
      }
    });
    vista.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-form="fechas"]');
      if (!form) return;
      ev.preventDefault();
      const n = form.n.value === '' ? null : parseInt(form.n.value, 10);
      if (n !== null && !(n > 0)) return error('La cantidad de fechas tiene que ser un número mayor que cero.');
      try {
        const tid = (await CDM.api.admin.torneos()).find((t) => t.anio === Number(actual.anio) && filtros.sufijo(t.torneo_id) === actual.torneo).torneo_id;
        await CDM.api.admin.guardarFechasRegular(tid, n);
        CDM.admin.avisar(n ? 'Fase regular: ' + ui.plural(n, 'fecha', 'fechas') + '.' : 'Fase regular sin cantidad de fechas.');
        CDM.router.recargar();
      } catch (err) {
        error(err.message);
      }
    });
  }

  return { titulo: 'Resultados (admin)', seccion: 'admin', render, montar };
})();
