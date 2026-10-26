// Corregir jugadores y unir duplicados (#/admin/jugadores) — PLAN 4.5.3.
// Los datos de cada jugador y sus torneos se editan en #/admin/jugadores/:id (6.6.4).
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminJugadores = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  let datos = [];
  let seleccion = [];      // ids elegidos para unir (máximo 2)
  let filtro = '';
  let vistaActual = null;

  const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const nombre = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');

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

  function fila(j) {
    const elegido = seleccion.includes(j.jugador_id);
    return '<li class="jugador' + (elegido ? ' jugador--elegido' : '') + '">' +
      '<label class="check jugador__check"><input type="checkbox" data-elegir="' + e(j.jugador_id) + '"' + (elegido ? ' checked' : '') +
      (!elegido && seleccion.length >= 2 ? ' disabled' : '') + '><span class="oculto">Elegir para unir</span></label>' +
      '<div class="jugador__datos"><div class="jugador__nombre">' + e(nombre(j)) + (j.apodo ? ' <span class="texto-2">(' + e(j.apodo) + ')</span>' : '') + '</div>' +
      '<div class="texto-2">' + e(rangos(j.anios)) + ' · ' + ui.plural(Number(j.goles), 'gol', 'goles') + ' · ' +
      ui.plural(Number(j.partidos), 'partido', 'partidos') + (j.division ? ' · ' + e(j.division) : '') + '</div>' +
      (j.notas ? '<div class="jugador__notas">' + e(j.notas) + '</div>' : '') + '</div>' +
      '<a class="enlace" href="#/admin/jugadores/' + encodeURIComponent(j.jugador_id) + '">Editar</a></li>';
  }

  function lista() {
    const f = sinAcentos(filtro);
    const visibles = datos.filter((j) => !f || sinAcentos([j.apellido, j.nombre, j.apodo].join(' ')).includes(f));
    return '<p class="nota">' + ui.plural(visibles.length, 'jugador', 'jugadores') + (f ? ' con "' + e(filtro) + '"' : '') + '</p>' +
      '<ul class="jugadores">' + visibles.map(fila).join('') + '</ul>';
  }

  function barraUnir() {
    if (seleccion.length < 2) {
      return '<div class="unir"><p class="nota">Para unir dos jugadores, tildá los dos.' +
        (seleccion.length === 1 ? ' Falta elegir uno más.' : '') + '</p></div>';
    }
    const [a, b] = seleccion.map((id) => datos.find((j) => j.jugador_id === id));
    // Por defecto queda el que tiene más partidos
    const queda = Number(b.partidos) > Number(a.partidos) ? b : a;
    return '<div class="unir unir--lista"><div class="campo"><label for="u-queda">Queda</label><select id="u-queda">' +
      [a, b].map((j) => '<option value="' + e(j.jugador_id) + '"' + (j === queda ? ' selected' : '') + '>' + e(nombre(j)) + '</option>').join('') +
      '</select></div><p class="nota">El otro se borra y sus goles, partidos, tarjetas y notas pasan al que queda.</p>' +
      '<div class="botones-chicos"><button type="button" class="boton" data-accion="unir">Unir</button>' +
      '<button type="button" class="boton boton--borde" data-accion="limpiar">Cancelar</button></div></div>';
  }

  function pintarLista() {
    const l = vistaActual && vistaActual.querySelector('#lista-jugadores');
    if (l) l.innerHTML = lista();
    const u = vistaActual && vistaActual.querySelector('#barra-unir');
    if (u) u.innerHTML = barraUnir();
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { datos = []; return acceso.html; }
    // ?editar=J012 (links viejos): la edición está en la pantalla del jugador (6.6.4)
    if (query && query.get('editar')) {
      location.replace(CDM.router.armar('/admin/jugadores/' + encodeURIComponent(query.get('editar')), { volver: query.get('volver') || undefined }));
      return '';
    }
    // Si todavía no se corrió 12_duplicados.sql, el contador no aparece
    const [resumen, pares] = await Promise.all([CDM.api.admin.jugadoresResumen(), CDM.api.admin.posiblesDuplicados().catch(() => null)]);
    datos = resumen;
    seleccion = seleccion.filter((id) => datos.some((j) => j.jugador_id === id));
    const pendientes = pares ? pares.filter((p) => !p.descartado).length : null;
    const aviso = CDM.admin.tomarAviso();
    return CDM.admin.barra('Jugadores', acceso.admin, { actual: 'jugadores' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      (pendientes == null ? '' : '<section class="tarjeta tarjeta--fila" aria-label="Posibles duplicados"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Posibles duplicados (' + pendientes + ')</h2>' +
        '<a class="enlace" href="#/admin/jugadores/duplicados">' + (pendientes ? 'Revisar' : 'Ver descartados') + '</a></section>') +
      '<section class="tarjeta" aria-label="Unir jugadores"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Unir jugadores</h2><div id="barra-unir">' + barraUnir() + '</div></section>' +
      '<section class="tarjeta" aria-label="Lista de jugadores"><div class="campo"><label for="buscar">Buscar</label>' +
      '<input id="buscar" type="search" value="' + e(filtro) + '" placeholder="Apellido, nombre o apodo" autocomplete="off"></div>' +
      '<div id="lista-jugadores">' + lista() + '</div></section>';
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    vista.addEventListener('input', (ev) => {
      if (ev.target.id === 'buscar') { filtro = ev.target.value; pintarLista(); }
    });
    vista.addEventListener('change', (ev) => {
      const id = ev.target.dataset.elegir;
      if (!id) return;
      seleccion = ev.target.checked ? seleccion.concat(id).slice(-2) : seleccion.filter((x) => x !== id);
      pintarLista();
    });
    vista.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-accion]');
      if (!b) return;
      if (b.dataset.accion === 'limpiar') { seleccion = []; pintarLista(); return; }
      if (b.dataset.accion === 'unir') {
        const queda = vista.querySelector('#u-queda').value;
        const sobra = seleccion.find((x) => x !== queda);
        const jq = datos.find((j) => j.jugador_id === queda);
        const js = datos.find((j) => j.jugador_id === sobra);
        if (!window.confirm('¿Unir a ' + nombre(js) + ' con ' + nombre(jq) + '? ' + nombre(js) + ' se borra y todo lo suyo pasa a ' + nombre(jq) + '. No se puede deshacer.')) return;
        b.disabled = true;
        try {
          const r = await CDM.api.admin.unirJugadores(queda, sobra);
          seleccion = [];
          CDM.admin.avisar('Unidos: ' + nombre(js) + ' pasó a ' + nombre(jq) + ' (' + ui.plural(r.goles, 'gol', 'goles') + ', ' +
            ui.plural(r.formaciones, 'formación', 'formaciones') + ').');
          CDM.router.recargar();
        } catch (err) {
          b.disabled = false;
          error(err.message);
        }
      }
    });
  }

  return { titulo: 'Jugadores', seccion: 'admin', render, montar };
})();
