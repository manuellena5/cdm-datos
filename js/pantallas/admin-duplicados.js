// Posibles duplicados (#/admin/jugadores/duplicados) — PLAN 6.5.3, mockup 11.
// Pares de jugadores con el mismo apellido: comparar partido por partido, unir, descartar
// o pasar un dato suelto de uno al otro. Los pares y el "aparecen juntos" salen de v_posibles_duplicados.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminDuplicados = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  let ctx = null;
  let vistaActual = null;

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
  const nombre = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');
  // Sin nombre o solo iniciales: "J.", "J", "A. B."
  const soloInicial = (n) => !n || /^\p{L}\.?(\s+\p{L}\.?)*$/u.test(String(n).trim());
  const conPunto = (t) => (/\.$/.test(t) ? t : t + '.');   // "Lencina, H." no lleva otro punto
  const clavePar = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const enlacePar = (par, ver) => '#/admin/jugadores/duplicados?a=' + encodeURIComponent(par.jugador_a) + '&b=' + encodeURIComponent(par.jugador_b) +
    (ver === 'descartados' ? '&ver=descartados' : '');

  // [2011, 2012, 2013, 2016] → '2011–2013, 2016'
  function rangos(anios) {
    const a = (anios || []).slice().sort((x, y) => x - y);
    const partes = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      partes.push(i === j ? String(a[i]) : a[i] + '–' + a[j]);
      i = j;
    }
    return partes.join(', ') || 'Sin partidos';
  }

  // Qué tan probable es que sean el mismo: 0 = a uno le falta el nombre o tiene la inicial,
  // 1 = un nombre empieza con el otro (Juan / Juan Carlos), 2 = dos nombres distintos.
  function probabilidad(a, b) {
    if (soloInicial(a.nombre) || soloInicial(b.nombre)) return 0;
    const na = norm(a.nombre), nb = norm(b.nombre);
    return na.startsWith(nb) || nb.startsWith(na) ? 1 : 2;
  }

  function ordenar(pares) {
    return pares.slice().sort((x, y) => (x.partidos_juntos > 0) - (y.partidos_juntos > 0) ||
      probabilidad(x.ja, x.jb) - probabilidad(y.ja, y.jb) || nombre(x.ja).localeCompare(nombre(y.ja), 'es'));
  }

  function estadoPar(par) {
    return par.partidos_juntos > 0
      ? '<span class="etiqueta etiqueta--falta">Juntos en ' + ui.plural(par.partidos_juntos, 'partido', 'partidos') + ' · no pueden ser el mismo</span>'
      : '<span class="etiqueta etiqueta--info">Nunca juntos</span>';
  }

  // ---------- Lista de pares (izquierda) ----------
  function listaHtml() {
    const lista = ctx.ver === 'descartados' ? ctx.descartados : ctx.pendientes;
    const pestana = (clave, texto, n) => '<a href="#/admin/jugadores/duplicados' + (clave === 'descartados' ? '?ver=descartados' : '') + '"' +
      (ctx.ver === clave ? ' aria-current="page"' : '') + '>' + texto + ' (' + n + ')</a>';
    return '<nav class="dup-pestanas" aria-label="Pares">' + pestana('pendientes', 'Pendientes', ctx.pendientes.length) +
      pestana('descartados', 'Descartados', ctx.descartados.length) + '</nav>' +
      (lista.length ? '<ul class="dup-lista">' + lista.map((par) => '<li><a class="dup-par" href="' + enlacePar(par, ctx.ver) + '"' +
        (ctx.par && clavePar(par.jugador_a, par.jugador_b) === clavePar(ctx.par.jugador_a, ctx.par.jugador_b) ? ' aria-current="true"' : '') + '>' +
        '<span class="dup-par__nombres"><span>' + e(nombre(par.ja)) + '</span><span>' + e(nombre(par.jb)) + '</span></span>' +
        estadoPar(par) + '</a></li>').join('') + '</ul>'
        : '<p class="nota">' + (ctx.ver === 'descartados' ? 'No hay pares descartados.' : 'No quedan posibles duplicados para revisar.') + '</p>');
  }

  // ---------- Detalle del par (derecha) ----------
  function resumenJugador(j, datos) {
    const partidos = new Set(datos.map((d) => d.partido_id)).size;
    const goles = datos.filter((d) => d.clase === 'gol');
    const penales = goles.filter((d) => d.detalle === 'Gol de penal').length;
    const rojas = datos.filter((d) => d.clase === 'incidencia' && /Roja|Doble amarilla/.test(d.detalle)).length;
    return '<div class="dup-jugador"><a class="dup-jugador__nombre" href="#/jugador/' + encodeURIComponent(j.jugador_id) + '">' + e(nombre(j)) + '</a>' +
      (j.apodo ? '<span class="texto-2"> (' + e(j.apodo) + ')</span>' : '') +
      '<div class="texto-2">' + e(rangos(j.anios)) + '</div>' +
      '<div>' + ui.plural(partidos, 'partido con datos', 'partidos con datos') +
      (goles.length ? ' · ' + ui.plural(goles.length, 'gol', 'goles') + (penales ? ' (' + penales + ' de penal)' : '') : '') +
      (rojas ? ' · ' + ui.plural(rojas, 'roja', 'rojas') : '') + '</div>' +
      (j.notas ? '<div class="jugador__notas">' + e(j.notas) + '</div>' : '') + '</div>';
  }

  function textoPartido(p) {
    if (!p) return { arriba: 'Partido', abajo: '' };
    const gl = p.goles_local != null ? ' ' + p.goles_local + ' – ' + p.goles_visitante + ' ' : ' – ';
    return {
      arriba: p.local + gl + p.visitante,
      abajo: [p.torneo, ui.instanciaLarga(p), ui.fechaCorta(p.fecha), p.categoria === 'Reserva' ? 'Reserva' : '', p.publicado === false ? 'Borrador' : '']
        .filter(Boolean).join(' · ')
    };
  }

  function celdaDatos(datos, de, a) {
    if (!datos.length) return '<span class="texto-2">—</span>';
    return '<ul class="dup-datos">' + datos.map((d) => '<li><span>' + e(d.detalle + (d.minuto != null ? ' ' + d.minuto + "'" : '')) + '</span>' +
      '<button type="button" class="enlace-boton" data-pasar="' + e([d.clase, d.dato_id || '', d.partido_id, de.jugador_id, a.jugador_id].join('|')) + '">' +
      'Pasar a ' + e(nombre(a)) + '</button></li>').join('') + '</ul>';
  }

  function tablaPartidos(a, b) {
    const ids = [...new Set(ctx.datos.map((d) => d.partido_id))];
    const filas = ids.map((id) => ({ id, p: ctx.porPartido[id] }))
      .sort((x, y) => String((x.p && x.p.fecha) || x.id).localeCompare(String((y.p && y.p.fecha) || y.id)) || x.id.localeCompare(y.id));
    if (!filas.length) return '<p class="nota">Ninguno de los dos tiene goles, tarjetas ni formación cargados.</p>';
    return '<div class="tabla-scroll"><table class="tabla tabla--dup"><thead><tr><th scope="col">Partido</th><th scope="col">' + e(nombre(a)) + '</th>' +
      '<th scope="col">' + e(nombre(b)) + '</th><th scope="col"><span class="oculto">Acciones</span></th></tr></thead><tbody>' +
      filas.map(({ id, p }) => {
        const t = textoPartido(p);
        const da = ctx.datos.filter((d) => d.partido_id === id && d.jugador_id === a.jugador_id);
        const db = ctx.datos.filter((d) => d.partido_id === id && d.jugador_id === b.jugador_id);
        return '<tr' + (da.length && db.length ? ' class="dup-fila--juntos"' : '') + '><th scope="row"><div>' + e(t.arriba) + '</div><div class="texto-2">' + e(t.abajo) + '</div></th>' +
          '<td data-titulo="' + e(nombre(a)) + '">' + celdaDatos(da, a, b) + '</td><td data-titulo="' + e(nombre(b)) + '">' + celdaDatos(db, b, a) + '</td>' +
          '<td><a class="enlace" href="#/admin/partido/' + encodeURIComponent(id) + '">Ver partido</a></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function detalleHtml() {
    const par = ctx.par;
    if (!par) return '<section class="tarjeta dup-detalle"><p class="nota">Elegí un par de la lista.</p></section>';
    const a = par.ja, b = par.jb;
    const datosDe = (j) => ctx.datos.filter((d) => d.jugador_id === j.jugador_id);
    const golesTotal = ctx.datos.filter((d) => d.clase === 'gol').length;
    // Queda el que tiene más partidos; el nombre final, el más completo
    const queda = Number(b.partidos) > Number(a.partidos) ? b : a;
    const completo = (x) => (soloInicial(x.nombre) ? 0 : norm(x.nombre).length);
    const sugerido = completo(b) > completo(a) ? b : a;
    const mensaje = par.partidos_juntos > 0
      ? '<p class="aviso-suave">Coinciden en ' + ui.plural(par.partidos_juntos, 'partido', 'partidos') + ': no pueden ser la misma persona, salvo que haya un error en ' +
        (par.partidos_juntos === 1 ? 'ese partido (está marcado' : 'esos partidos (están marcados') + ' en la tabla).</p>'
      : '<p class="dup-mensaje">Nunca aparecen en el mismo partido, así que pueden ser la misma persona.' +
        (par.listas_juntos ? ' Ojo: están los dos en la lista de ' + ui.plural(par.listas_juntos, 'torneo', 'torneos') + '.' : '') + '</p>';
    const decidir = par.descartado
      ? '<section class="dup-accion"><h3>Marcados como distintos</h3><p class="nota">' +
        e(['Por ' + (par.descartado_por || 'un administrador'), par.descartado_en ? 'el ' + ui.fechaCorta(String(par.descartado_en).slice(0, 10)) : ''].filter(Boolean).join(' ')) +
        (par.motivo ? '. Motivo: ' + e(par.motivo) : '') + '.</p>' +
        '<button type="button" class="boton boton--borde" data-accion="volver">Volver a pendientes</button></section>'
      : '<section class="dup-accion"><h3>Son el mismo</h3>' +
        (par.partidos_juntos > 0
          ? '<p class="nota">No se pueden unir mientras aparezcan juntos. Si es un error de carga, corregí el partido o pasá el dato al otro.</p>'
          : '<div class="fila-2"><div class="campo"><label for="d-ap">Apellido</label><input id="d-ap" value="' + e(sugerido.apellido) + '" autocomplete="off"></div>' +
            '<div class="campo"><label for="d-no">Nombre</label><input id="d-no" value="' + e(sugerido.nombre || '') + '" autocomplete="off"></div></div>' +
            '<p class="nota">' + (golesTotal ? 'Quedan los ' + ui.plural(golesTotal, 'gol', 'goles') + ' en un solo jugador. ' : '') + 'Queda en el registro de cambios.</p>' +
            '<button type="button" class="boton" data-accion="unir" data-queda="' + e(queda.jugador_id) + '">Unir en un solo jugador</button>') +
        '</section>' +
        '<section class="dup-accion"><h3>No son el mismo</h3><div class="campo"><label for="d-motivo">Por qué (opcional)</label>' +
        '<input id="d-motivo" autocomplete="off" placeholder="Por ejemplo: son hermanos"></div>' +
        '<p class="nota">El par no vuelve a aparecer como posible duplicado.</p>' +
        '<button type="button" class="boton boton--borde" data-accion="descartar">Descartar</button></section>';
    const editar = (j) => CDM.router.armar('/admin/jugadores/' + encodeURIComponent(j.jugador_id), { volver: enlacePar(par, ctx.ver) });
    return '<section class="tarjeta dup-detalle" aria-label="Par elegido"><h2 class="tarjeta__titulo">¿Son el mismo jugador?</h2>' +
      '<div class="dup-jugadores">' + resumenJugador(a, datosDe(a)) + resumenJugador(b, datosDe(b)) + '</div>' + mensaje +
      '<h3 class="dup-sub">Partidos donde aparece cada uno</h3>' + tablaPartidos(a, b) +
      '<div class="dup-acciones">' + decidir + '</div>' +
      '<div class="botones-chicos dup-pie">' +
      '<a class="boton boton--borde" href="' + editar(a) + '">Editar datos de ' + e(nombre(a)) + '</a>' +
      '<a class="boton boton--borde" href="' + editar(b) + '">Editar datos de ' + e(nombre(b)) + '</a>' +
      (par.descartado ? '' : '<button type="button" class="boton boton--borde" data-accion="despues">Decidir después</button>') + '</div></section>';
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // El par siguiente al actual en la lista de pendientes (para seguir después de decidir).
  function siguiente() {
    const i = ctx.pendientes.findIndex((p) => ctx.par && clavePar(p.jugador_a, p.jugador_b) === clavePar(ctx.par.jugador_a, ctx.par.jugador_b));
    return ctx.pendientes[i + 1] || ctx.pendientes.find((p, k) => k !== i) || null;
  }
  function irA(par) {
    location.hash = par ? enlacePar(par, 'pendientes') : '#/admin/jugadores/duplicados';
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const api = CDM.api.admin;
    const [pares, jugadores, partidos] = await Promise.all([api.posiblesDuplicados(), api.jugadoresResumen(), api.partidos()]);
    const porId = Object.fromEntries(jugadores.map((j) => [j.jugador_id, j]));
    const completos = pares.filter((p) => porId[p.jugador_a] && porId[p.jugador_b])
      .map((p) => Object.assign({}, p, { ja: porId[p.jugador_a], jb: porId[p.jugador_b] }));
    const ver = query.get('ver') === 'descartados' ? 'descartados' : 'pendientes';
    const qa = query.get('a'), qb = query.get('b');
    ctx = {
      ver,
      pendientes: ordenar(completos.filter((p) => !p.descartado)),
      descartados: completos.filter((p) => p.descartado).sort((x, y) => String(y.descartado_en).localeCompare(String(x.descartado_en))),
      porPartido: Object.fromEntries(partidos.map((p) => [p.partido_id, p])),
      datos: []
    };
    const lista = ver === 'descartados' ? ctx.descartados : ctx.pendientes;
    ctx.par = qa && qb
      ? completos.find((p) => clavePar(p.jugador_a, p.jugador_b) === clavePar(qa, qb)) || null
      : lista[0] || null;
    if (ctx.par) ctx.datos = await api.datosJugadores([ctx.par.jugador_a, ctx.par.jugador_b]);
    const aviso = CDM.admin.tomarAviso();
    return CDM.admin.barra('Posibles duplicados', acceso.admin, { actual: 'jugadores', volver: '#/admin/jugadores' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      (qa && qb && !ctx.par ? '<p class="aviso-suave">Ese par ya no está: se unieron o se corrigió el apellido de alguno.</p>' : '') +
      '<div class="dup-layout"><aside class="tarjeta dup-lado" aria-label="Lista de pares">' + listaHtml() + '</aside>' + detalleHtml() + '</div>';
  }

  function montar(vista, params, query) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    // En el celular la lista queda arriba: si se abrió un par, bajar hasta él
    // (después de que el router lleve la página arriba)
    const det = vista.querySelector('.dup-detalle');
    if (det && query && query.get('a') && window.matchMedia('(max-width: 720px)').matches) setTimeout(() => det.scrollIntoView({ block: 'start' }), 0);
    vista.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-accion], [data-pasar]');
      if (!b || !ctx || !ctx.par) return;
      const par = ctx.par;
      const api = CDM.api.admin;
      if (b.dataset.accion === 'despues') return irA(siguiente());
      b.disabled = true;
      try {
        if (b.dataset.pasar) {
          const [clase, dato, partido, de, a] = b.dataset.pasar.split('|');
          const jde = de === par.ja.jugador_id ? par.ja : par.jb;
          const ja = a === par.ja.jugador_id ? par.ja : par.jb;
          await api.pasarDato(clase, dato, partido, de, a);
          CDM.admin.avisar(conPunto('Pasado: el dato de ' + nombre(jde) + ' ahora es de ' + nombre(ja)));
          return CDM.router.recargar();
        }
        if (b.dataset.accion === 'descartar') {
          await api.descartarPar(par.jugador_a, par.jugador_b, vista.querySelector('#d-motivo').value.trim());
          CDM.admin.avisar('Listo: ' + nombre(par.ja) + ' y ' + nombre(par.jb) + ' quedan como jugadores distintos.');
          return irA(siguiente());
        }
        if (b.dataset.accion === 'volver') {
          await api.volverAPendientes(par.jugador_a, par.jugador_b);
          CDM.admin.avisar('El par volvió a pendientes.');
          location.hash = enlacePar(par, 'pendientes');
          return;
        }
        if (b.dataset.accion === 'unir') {
          const apellido = vista.querySelector('#d-ap').value.trim();
          const nombreFinal = vista.querySelector('#d-no').value.trim();
          if (!apellido) { b.disabled = false; return error('El apellido no puede quedar vacío.'); }
          const queda = b.dataset.queda === par.ja.jugador_id ? par.ja : par.jb;
          const sobra = queda === par.ja ? par.jb : par.ja;
          if (!window.confirm('¿Unir a ' + nombre(par.ja) + ' y ' + nombre(par.jb) + ' en "' + apellido + (nombreFinal ? ', ' + nombreFinal : '') +
            '"? Todo lo de los dos queda en un solo jugador. No se puede deshacer.')) { b.disabled = false; return; }
          const siguientePar = siguiente();
          const r = await api.unirJugadores(queda.jugador_id, sobra.jugador_id);
          if (apellido !== queda.apellido || nombreFinal !== (queda.nombre || '')) {
            await api.editarJugador(queda.jugador_id, { apellido, nombre: nombreFinal || null });
          }
          CDM.admin.avisar(conPunto('Unidos en ' + apellido + (nombreFinal ? ', ' + nombreFinal : '')) +
            (r.goles ? ' Pasaron ' + ui.plural(r.goles, 'gol', 'goles') + '.' : ''));
          return irA(siguientePar && ![queda.jugador_id, sobra.jugador_id].some((id) => [siguientePar.jugador_a, siguientePar.jugador_b].includes(id)) ? siguientePar : null);
        }
      } catch (err) {
        b.disabled = false;
        error(err.message);
      }
    });
  }

  return { titulo: 'Posibles duplicados', seccion: 'admin', render, montar };
})();
