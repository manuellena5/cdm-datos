// Listas de jugadores por torneo y categoría (#/admin/planteles?torneo=2026C&cat=P).
// Se pega la lista (o se sube un .txt/.csv), se revisa cómo se reconoció cada jugador y se guarda.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminPlanteles = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  let ctx = null;      // { torneo, categoria, cat, torneos, jugadores, lista, enPartidos }
  let revision = [];   // filas reconocidas de la lista pegada
  let vistaActual = null;

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
  const nombre = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');
  const tituloCaso = (t) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : t);

  // "9. RUIZ DIAZ, Gabriel" · "Ruiz Díaz Gabriel" · "9;Ruiz Díaz;Gabriel" → { camiseta, apellido, nombre }
  function leerLinea(linea) {
    let t = linea.trim();
    if (!t || /apellido|nombre|jugador/i.test(t) && !/\d/.test(t) && t.split(/[,;\t]/).length > 1) return null;
    let camiseta = null;
    const partes = t.split(/[;\t]/).map((x) => x.trim()).filter(Boolean);
    if (partes.length > 1) {
      const num = partes.findIndex((x) => /^\d{1,2}$/.test(x));
      if (num >= 0) camiseta = Number(partes.splice(num, 1)[0]);
      if (partes.length >= 2) return { camiseta, apellido: tituloCaso(partes[0]), nombre: tituloCaso(partes[1]) };
      t = partes[0] || '';
    }
    const m = t.match(/^(\d{1,2})[\s.\-)]+(.*)$/);
    if (m) { camiseta = Number(m[1]); t = m[2]; }
    if (t.includes(',')) {
      const [ap, no] = t.split(',');
      return { camiseta, apellido: tituloCaso(ap.trim()), nombre: tituloCaso((no || '').trim()) };
    }
    const tokens = t.split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    // Sin coma: se supone "Apellido Nombre" (el nombre es la última palabra). Se puede corregir en la revisión.
    if (tokens.length === 1) return { camiseta, apellido: tituloCaso(tokens[0]), nombre: '' };
    return { camiseta, apellido: tituloCaso(tokens.slice(0, -1).join(' ')), nombre: tituloCaso(tokens[tokens.length - 1]) };
  }

  // Jugadores de la base que coinciden con la línea (también con el orden nombre-apellido invertido o con inicial).
  function candidatos(l) {
    const ap = norm(l.apellido), no = norm(l.nombre);
    const juntos = norm(l.apellido + ' ' + l.nombre);
    const coincideNombre = (jn, x) => jn === x || jn.startsWith(x) || x.startsWith(jn) || jn.split(' ')[0] === x.split(' ')[0];
    // Seguros: mismo apellido y nombre compatible (o el nombre completo igual en cualquier orden)
    const fuertes = ctx.jugadores.filter((j) => {
      const ja = norm(j.apellido), jn = norm(j.nombre);
      return (ja === ap && jn && no && coincideNombre(jn, no)) ||
        (jn && (norm(j.apellido + ' ' + j.nombre) === juntos || norm(j.nombre + ' ' + j.apellido) === juntos));
    });
    if (fuertes.length) return { fuertes, posibles: [], parecidos: [] };
    // Posibles: mismo apellido y a uno de los dos le falta el nombre (puede ser la misma persona)
    const posibles = ctx.jugadores.filter((j) => norm(j.apellido) === ap && (!norm(j.nombre) || !no));
    if (posibles.length) return { fuertes: [], posibles, parecidos: [] };
    const parecidos = ctx.jugadores.filter((j) => {
      const ja = norm(j.apellido);
      return ja && (ja === ap || ja === norm(l.nombre) || juntos.includes(ja) && ja.length >= 4);
    }).slice(0, 6);
    return { fuertes: [], posibles: [], parecidos };
  }

  function revisar(texto) {
    const vistos = new Set();
    revision = texto.split(/\r?\n/).map(leerLinea).filter(Boolean).map((l) => {
      const c = candidatos(l);
      const elegido = c.fuertes[0] || c.posibles[0];
      return Object.assign(l, {
        opciones: c.fuertes.concat(c.posibles, c.parecidos),
        jugador_id: elegido ? elegido.jugador_id : '__nuevo',
        dudoso: c.fuertes.length > 1 || (!c.fuertes.length && c.posibles.length > 0)
      });
    }).filter((l) => {
      // la misma persona dos veces en la lista: queda una
      const k = l.jugador_id === '__nuevo' ? 'n:' + norm(l.apellido + l.nombre) : l.jugador_id;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }

  function htmlRevision() {
    if (!revision.length) return '';
    const nuevos = revision.filter((r) => r.jugador_id === '__nuevo').length;
    const filas = revision.map((r, i) => {
      const opciones = r.opciones.map((j) => '<option value="' + e(j.jugador_id) + '"' + (j.jugador_id === r.jugador_id ? ' selected' : '') + '>' + e(nombre(j)) + '</option>').join('');
      const otros = ctx.jugadores.filter((j) => !r.opciones.includes(j));
      return '<div class="revision-fila' + (r.jugador_id === '__nuevo' ? ' revision-fila--nuevo' : r.dudoso ? ' revision-fila--dudoso' : '') + '">' +
        '<div class="revision-fila__linea"><input class="revision-fila__camiseta" type="number" min="0" max="99" inputmode="numeric" data-rev="' + i + '" data-campo="camiseta" value="' + (r.camiseta ?? '') + '" placeholder="N°" aria-label="Camiseta">' +
        '<select data-rev="' + i + '" data-campo="jugador_id" aria-label="Jugador">' +
        '<option value="__nuevo"' + (r.jugador_id === '__nuevo' ? ' selected' : '') + '>Jugador nuevo: ' + e(r.apellido + (r.nombre ? ', ' + r.nombre : '')) + '</option>' +
        (opciones ? '<optgroup label="Coincide o se parece">' + opciones + '</optgroup>' : '') +
        '<optgroup label="Otros">' + otros.map((j) => '<option value="' + e(j.jugador_id) + '"' + (j.jugador_id === r.jugador_id ? ' selected' : '') + '>' + e(nombre(j)) + '</option>').join('') + '</optgroup>' +
        '</select><button type="button" class="enlace-boton" data-quitar-rev="' + i + '">Quitar</button></div>' +
        (r.jugador_id === '__nuevo' ? '<div class="fila-2"><div class="campo"><label>Apellido</label><input data-rev="' + i + '" data-campo="apellido" value="' + e(r.apellido) + '"></div>' +
          '<div class="campo"><label>Nombre</label><input data-rev="' + i + '" data-campo="nombre" value="' + e(r.nombre) + '"></div></div>' : '') +
        (r.dudoso ? '<p class="aviso-suave">' + (r.opciones.length > 1 ? 'Hay más de un jugador que coincide: confirmá cuál es (o elegí "Jugador nuevo").'
          : 'Coincide el apellido pero falta el nombre en uno de los dos: confirmá si es el mismo jugador.') + '</p>' : '') + '</div>';
    }).join('');
    const otroTorneo = ctx.torneos.filter((t) => t.anio === ctx.torneo.anio && t.torneo_id !== ctx.torneo.torneo_id);
    return '<div class="revision"><p class="nota">' + ui.plural(revision.length, 'jugador reconocido', 'jugadores reconocidos') +
      (nuevos ? ' · ' + ui.plural(nuevos, 'jugador nuevo', 'jugadores nuevos') + ' (se crean al guardar)' : '') +
      '. Revisá cada uno: si alguno ya existe con otro nombre, elegilo en la lista para no duplicarlo.</p>' + filas +
      (otroTorneo.length ? '<label class="check"><input type="checkbox" id="lista-otros"> Usar la misma lista para ' + e(ui.unir(otroTorneo.map((t) => t.nombre))) + '</label>' : '') +
      '<div class="botones-chicos"><button type="button" class="boton" data-accion="guardar-lista">Guardar lista</button>' +
      '<button type="button" class="boton boton--borde" data-accion="descartar-lista">Descartar</button></div></div>';
  }

  function pintarRevision() {
    const r = vistaActual.querySelector('#revision');
    if (r) r.innerHTML = htmlRevision();
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const [torneos, jugadores] = await Promise.all([CDM.api.admin.torneos(), CDM.api.admin.jugadores()]);
    const torneo = torneos.find((t) => t.torneo_id === query.get('torneo')) || torneos[0];
    const cat = query.get('cat') === 'R' ? 'R' : 'P';
    const categoria = cat === 'R' ? 'Reserva' : 'Primera';
    const [lista, plantel] = await Promise.all([
      CDM.api.admin.listaPlantel(torneo.torneo_id, categoria), CDM.api.admin.plantelTorneo(torneo.torneo_id, categoria)
    ]);
    const porId = Object.fromEntries(jugadores.map((j) => [j.jugador_id, j]));
    const enPartidos = plantel.filter((x) => !x.en_lista && (Number(x.partidos) > 0 || Number(x.goles) > 0));
    ctx = { torneo, categoria, cat, torneos, jugadores, lista, enPartidos };
    revision = [];
    const aviso = CDM.admin.tomarAviso();

    const filasLista = lista.map((x) => {
      const j = porId[x.jugador_id] || { apellido: '?', nombre: '' };
      return '<li class="jugador"><span class="lista__camiseta">' + (x.camiseta ?? '') + '</span><div class="jugador__datos"><a class="jugador__nombre" href="#/jugador/' +
        encodeURIComponent(x.jugador_id) + '">' + e(nombre(j)) + '</a>' + (x.posicion ? '<div class="texto-2">' + e(x.posicion) + '</div>' : '') + '</div>' +
        '<button type="button" class="enlace-boton" data-quitar-lista="' + e(x.jugador_id) + '">Quitar</button></li>';
    }).join('');

    return CDM.admin.barra('Planteles', acceso.admin, { actual: 'planteles' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<section class="filtros" aria-label="Torneo">' +
      ui.selector('torneo', 'Torneo', torneos.map((t) => ({ valor: t.torneo_id, texto: t.nombre })), torneo.torneo_id) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) + '</section>' +
      '<p class="form-error" role="alert" hidden></p>' +
      '<section class="tarjeta carga" aria-label="Cargar lista"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Cargar lista · ' + e(torneo.nombre + ' · ' + categoria) + '</h2>' +
      '<p class="nota">Pegá la lista (un jugador por línea: "Apellido, Nombre", con el número de camiseta adelante si lo tenés) o copiala desde una planilla. ' +
      'También podés subir un archivo .txt o .csv. Los jugadores que ya están en la lista no se duplican.</p>' +
      '<div class="campo"><label for="lista-texto">Lista</label><textarea id="lista-texto" rows="8" placeholder="1. Manasseri, Mauro&#10;2. Bernaus, Federico&#10;9 Ruiz Díaz Gabriel"></textarea></div>' +
      '<div class="botones-chicos"><button type="button" class="boton" data-accion="revisar">Revisar lista</button>' +
      '<label class="boton boton--borde boton-archivo">Subir archivo<input type="file" accept=".txt,.csv,text/plain,text/csv" id="lista-archivo" class="oculto"></label></div>' +
      '<div id="revision"></div></section>' +
      (enPartidos.length ? '<section class="tarjeta" aria-label="Aparecen en partidos"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Jugaron y no están en la lista (' + enPartidos.length + ')</h2>' +
        '<p class="nota">' + e(enPartidos.map((x) => x.jugador).join(' · ')) + '</p>' +
        '<button type="button" class="boton boton--borde" data-accion="agregar-jugaron">Agregarlos a la lista</button></section>' : '') +
      '<section class="tarjeta" aria-label="Lista actual"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Lista actual (' + lista.length + ')</h2>' +
      (lista.length ? '<ul class="jugadores">' + filasLista + '</ul>' : ui.vacio('Todavía no hay lista cargada para este torneo y categoría.')) + '</section>';
  }

  async function guardar(boton) {
    const otros = vistaActual.querySelector('#lista-otros');
    const torneos = [ctx.torneo.torneo_id].concat(otros && otros.checked
      ? ctx.torneos.filter((t) => t.anio === ctx.torneo.anio && t.torneo_id !== ctx.torneo.torneo_id).map((t) => t.torneo_id) : []);
    const faltaApellido = revision.find((r) => r.jugador_id === '__nuevo' && !String(r.apellido).trim());
    if (faltaApellido) return error('Hay un jugador nuevo sin apellido.');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      // Primero se crean los jugadores nuevos
      for (const r of revision.filter((x) => x.jugador_id === '__nuevo')) {
        r.jugador_id = await CDM.api.admin.crearJugador(r.apellido.trim(), (r.nombre || '').trim(), ctx.categoria);
      }
      const ids = new Set();
      const filas = [];
      revision.forEach((r) => {
        if (ids.has(r.jugador_id)) return;
        ids.add(r.jugador_id);
        torneos.forEach((t) => filas.push({ torneo_id: t, categoria: ctx.categoria, jugador_id: r.jugador_id, camiseta: r.camiseta ?? null }));
      });
      await CDM.api.admin.guardarLista(filas);
      CDM.admin.avisar('Lista guardada: ' + ui.plural(ids.size, 'jugador', 'jugadores') + (torneos.length > 1 ? ' en ' + ui.plural(torneos.length, 'torneo', 'torneos') : '') + '.');
      CDM.router.recargar();
    } catch (err) {
      boton.disabled = false;
      boton.textContent = 'Guardar lista';
      error(err.message);
    }
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    const ir = (cambios) => CDM.router.cambiarFiltros('/admin/planteles', Object.assign({ torneo: ctx.torneo.torneo_id, cat: ctx.cat }, cambios));
    vista.addEventListener('change', async (ev) => {
      const el = ev.target;
      if (el.dataset.filtro === 'torneo') return ir({ torneo: el.value });
      if (el.id === 'lista-archivo' && el.files[0]) {
        if (el.files[0].size > 200000) return error('El archivo es muy grande. Pegá la lista en el cuadro de texto.');
        vista.querySelector('#lista-texto').value = await el.files[0].text();
        revisar(vista.querySelector('#lista-texto').value);
        return pintarRevision();
      }
      if (el.dataset.rev != null) {
        const r = revision[Number(el.dataset.rev)];
        const campo = el.dataset.campo;
        r[campo] = campo === 'camiseta' ? (el.value === '' ? null : parseInt(el.value, 10)) : el.value;
        if (campo === 'jugador_id') { r.dudoso = false; pintarRevision(); }
      }
    });
    vista.addEventListener('input', (ev) => {
      const el = ev.target;
      if (el.dataset.rev != null && el.tagName === 'INPUT' && el.dataset.campo !== 'camiseta') revision[Number(el.dataset.rev)][el.dataset.campo] = el.value;
    });
    vista.addEventListener('click', async (ev) => {
      const seg = ev.target.closest('[data-seg="cat"]');
      if (seg) return ir({ cat: seg.dataset.valor });
      const b = ev.target.closest('[data-accion], [data-quitar-rev], [data-quitar-lista]');
      if (!b) return;
      if (b.dataset.quitarRev != null) { revision.splice(Number(b.dataset.quitarRev), 1); return pintarRevision(); }
      if (b.dataset.quitarLista) {
        try {
          await CDM.api.admin.quitarDeLista(ctx.torneo.torneo_id, ctx.categoria, b.dataset.quitarLista);
          CDM.admin.avisar('Jugador quitado de la lista.');
          CDM.router.recargar();
        } catch (err) { error(err.message); }
        return;
      }
      switch (b.dataset.accion) {
        case 'revisar': {
          const texto = vista.querySelector('#lista-texto').value;
          if (!texto.trim()) return error('Pegá la lista o subí un archivo.');
          error('');
          revisar(texto);
          if (!revision.length) return error('No se reconoció ningún jugador en la lista.');
          return pintarRevision();
        }
        case 'descartar-lista': revision = []; return pintarRevision();
        case 'guardar-lista': return guardar(b);
        case 'agregar-jugaron': {
          b.disabled = true;
          try {
            await CDM.api.admin.guardarLista(ctx.enPartidos.map((x) => ({ torneo_id: ctx.torneo.torneo_id, categoria: ctx.categoria, jugador_id: x.jugador_id })));
            CDM.admin.avisar(ui.plural(ctx.enPartidos.length, 'jugador agregado', 'jugadores agregados') + ' a la lista.');
            CDM.router.recargar();
          } catch (err) { b.disabled = false; error(err.message); }
          return;
        }
        default:
      }
    });
  }

  return { titulo: 'Planteles', seccion: 'admin', render, montar };
})();
