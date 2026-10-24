// Corregir jugadores y unir duplicados (#/admin/jugadores) — PLAN 4.5.3.
// El ID del jugador no se toca: solo apellido, nombre, apodo y notas.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminJugadores = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  let datos = [];
  let seleccion = [];      // ids elegidos para unir (máximo 2)
  let editando = null;     // id del jugador en edición
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

  // Posibles duplicados: mismo apellido (sin acentos ni mayúsculas).
  function duplicados() {
    const grupos = new Map();
    datos.forEach((j) => {
      const k = sinAcentos(j.apellido).replace(/[^a-zñ ]/g, '');
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(j);
    });
    return [...grupos.values()].filter((g) => g.length > 1);
  }

  function fila(j) {
    const elegido = seleccion.includes(j.jugador_id);
    if (editando === j.jugador_id) {
      return '<li class="jugador jugador--editando"><form class="jugador__form" data-form="jugador" data-id="' + e(j.jugador_id) + '">' +
        '<div class="fila-2"><div class="campo"><label for="j-ap">Apellido</label><input id="j-ap" name="apellido" value="' + e(j.apellido) + '" required autocomplete="off"></div>' +
        '<div class="campo"><label for="j-no">Nombre</label><input id="j-no" name="nombre" value="' + e(j.nombre || '') + '" autocomplete="off"></div>' +
        '<div class="campo"><label for="j-apodo">Apodo</label><input id="j-apodo" name="apodo" value="' + e(j.apodo || '') + '" autocomplete="off"></div></div>' +
        '<div class="campo"><label for="j-notas">Notas</label><textarea id="j-notas" name="notas" rows="2">' + e(j.notas || '') + '</textarea></div>' +
        '<div class="botones-chicos"><button type="submit" class="boton">Guardar</button>' +
        '<button type="button" class="boton boton--borde" data-accion="cancelar">Cancelar</button></div></form></li>';
    }
    return '<li class="jugador' + (elegido ? ' jugador--elegido' : '') + '">' +
      '<label class="check jugador__check"><input type="checkbox" data-elegir="' + e(j.jugador_id) + '"' + (elegido ? ' checked' : '') +
      (!elegido && seleccion.length >= 2 ? ' disabled' : '') + '><span class="oculto">Elegir para unir</span></label>' +
      '<div class="jugador__datos"><div class="jugador__nombre">' + e(nombre(j)) + (j.apodo ? ' <span class="texto-2">(' + e(j.apodo) + ')</span>' : '') + '</div>' +
      '<div class="texto-2">' + e(rangos(j.anios)) + ' · ' + ui.plural(Number(j.goles), 'gol', 'goles') + ' · ' +
      ui.plural(Number(j.partidos), 'partido', 'partidos') + (j.division ? ' · ' + e(j.division) : '') + '</div>' +
      (j.notas ? '<div class="jugador__notas">' + e(j.notas) + '</div>' : '') + '</div>' +
      '<button type="button" class="enlace-boton" data-editar="' + e(j.jugador_id) + '">Editar</button></li>';
  }

  function lista() {
    const f = sinAcentos(filtro);
    const visibles = datos.filter((j) => !f || sinAcentos([j.apellido, j.nombre, j.apodo].join(' ')).includes(f));
    return '<p class="nota">' + ui.plural(visibles.length, 'jugador', 'jugadores') + (f ? ' con "' + e(filtro) + '"' : '') + '</p>' +
      '<ul class="jugadores">' + visibles.map(fila).join('') + '</ul>';
  }

  function barraUnir() {
    if (seleccion.length < 2) {
      return '<div class="unir"><p class="nota">Para unir dos jugadores, tildá los dos (o usá "Elegir estos" en un posible duplicado).' +
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

  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { datos = []; return acceso.html; }
    datos = await CDM.api.admin.jugadoresResumen();
    seleccion = seleccion.filter((id) => datos.some((j) => j.jugador_id === id));
    editando = null;
    const dups = duplicados();
    const aviso = CDM.admin.tomarAviso();
    return CDM.admin.barra('Jugadores', acceso.admin, { actual: 'jugadores' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      '<section class="tarjeta" aria-label="Posibles duplicados"><details' + (dups.length ? '' : ' disabled') + '><summary class="tarjeta__titulo tarjeta__titulo--chico">Posibles duplicados (' + dups.length + ')</summary>' +
      (dups.length ? '<ul class="duplicados">' + dups.map((g) => '<li><span>' + e(g.map(nombre).join(' · ')) + '</span>' +
        (g.length === 2 ? '<button type="button" class="enlace-boton" data-par="' + e(g.map((j) => j.jugador_id).join(',')) + '">Elegir estos</button>' : '') +
        '</li>').join('') + '</ul>' : '<p class="nota">No hay jugadores con el mismo apellido.</p>') + '</details></section>' +
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
      const b = ev.target.closest('[data-editar], [data-par], [data-accion]');
      if (!b) return;
      if (b.dataset.editar) { editando = b.dataset.editar; pintarLista(); const i = vista.querySelector('#j-ap'); if (i) i.focus(); return; }
      if (b.dataset.par) { seleccion = b.dataset.par.split(','); pintarLista(); vista.querySelector('#barra-unir').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (b.dataset.accion === 'cancelar') { editando = null; pintarLista(); return; }
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
    vista.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-form="jugador"]');
      if (!form) return;
      ev.preventDefault();
      const apellido = form.apellido.value.trim();
      if (!apellido) return error('El apellido no puede quedar vacío.');
      const campos = {
        apellido, nombre: form.nombre.value.trim() || null, apodo: form.apodo.value.trim() || null, notas: form.notas.value.trim() || null
      };
      try {
        await CDM.api.admin.editarJugador(form.dataset.id, campos);
        CDM.admin.avisar('Guardado: ' + apellido + (campos.nombre ? ', ' + campos.nombre : '') + '.');
        CDM.router.recargar();
      } catch (err) {
        error(err.message);
      }
    });
  }

  return { titulo: 'Jugadores', seccion: 'admin', render, montar };
})();
