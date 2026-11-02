// Árbitros (#/admin/arbitros) — PLAN 6.7.3.
// Cada árbitro tiene un código: renombrarlo cambia el nombre en todos sus partidos, y dos formas de
// escribir al mismo se unen en uno (los partidos del que se borra pasan al que queda).
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminArbitros = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  let ctx = null;
  let seleccion = [];      // códigos elegidos para unir (máximo 2)
  let filtro = '';
  let vistaActual = null;

  const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  // Distancia de edición (para "Ebel" / "Evel", "Rhull" / "Ruhl")
  function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
  }

  // Parecidos: el apellido igual o con una o dos letras distintas, y el nombre compatible
  // (misma inicial, o uno contiene las palabras del otro: "Ariel Lucero" / "Eduardo Ariel Lucero")
  function parecidos(lista) {
    const pares = [];
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = sinAcentos(lista[i].nombre).split(' '), b = sinAcentos(lista[j].nombre).split(' ');
        const apA = a[a.length - 1], apB = b[b.length - 1];
        const apellido = apA === apB || (apA.length > 3 && distancia(apA, apB) <= 2);
        const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
        const nombre = a[0][0] === b[0][0] || corto.every((p) => largo.includes(p));
        if (apellido && nombre) pares.push([lista[i], lista[j]]);
      }
    }
    return pares;
  }

  const datoArbitro = (a) => (a.partidos ? ui.plural(a.partidos, 'partido', 'partidos') + ' · último ' + ui.fechaCorta(a.ultimo) + '/' + a.ultimo.slice(0, 4) : 'Sin partidos');

  function filaHtml(a) {
    const elegido = seleccion.includes(a.arbitro_id);
    return '<li class="arbitro' + (elegido ? ' jugador--elegido' : '') + '" data-id="' + e(a.arbitro_id) + '">' +
      '<label class="check jugador__check"><input type="checkbox" data-elegir="' + e(a.arbitro_id) + '"' + (elegido ? ' checked' : '') +
      (!elegido && seleccion.length >= 2 ? ' disabled' : '') + '><span class="oculto">Elegir para unir</span></label>' +
      '<div class="arbitro__datos"><input class="arbitro__nombre" data-nombre value="' + e(a.nombre) + '" aria-label="Nombre del árbitro" autocomplete="off">' +
      '<div class="texto-2">' + e(datoArbitro(a)) + '</div><p class="plantel-estado" role="status"></p></div></li>';
  }

  function listaHtml() {
    const f = sinAcentos(filtro);
    const visibles = ctx.arbitros.filter((a) => !f || sinAcentos(a.nombre).includes(f));
    return '<p class="nota">' + ui.plural(visibles.length, 'árbitro', 'árbitros') + (f ? ' con "' + e(filtro) + '"' : '') + '</p>' +
      '<ul class="arbitros">' + visibles.map(filaHtml).join('') + '</ul>';
  }

  function unirHtml() {
    const pares = parecidos(ctx.arbitros);
    const sugeridos = pares.length
      ? '<p class="nota">Parecidos (¿el mismo escrito distinto?):</p><ul class="arbitros-parecidos">' + pares.map(([a, b]) =>
        '<li><span>' + e(a.nombre) + ' <span class="texto-2">(' + a.partidos + ')</span> / ' + e(b.nombre) + ' <span class="texto-2">(' + b.partidos + ')</span></span>' +
        '<button type="button" class="enlace-boton" data-par="' + e(a.arbitro_id + '|' + b.arbitro_id) + '">Unir</button></li>').join('') + '</ul>'
      : '';
    if (seleccion.length < 2) {
      return sugeridos + '<p class="nota">Para unir dos árbitros, tildá los dos en la lista o tocá "Unir" en un par parecido.' +
        (seleccion.length === 1 ? ' Falta elegir uno más.' : '') + '</p>';
    }
    const [a, b] = seleccion.map((id) => ctx.arbitros.find((x) => x.arbitro_id === id));
    const queda = b.partidos > a.partidos ? b : a;
    return '<div class="unir unir--lista"><div class="campo"><label for="u-queda">Queda</label><select id="u-queda">' +
      [a, b].map((x) => '<option value="' + e(x.arbitro_id) + '"' + (x === queda ? ' selected' : '') + '>' + e(x.nombre + ' (' + ui.plural(x.partidos, 'partido', 'partidos') + ')') + '</option>').join('') +
      '</select></div><p class="nota">El otro se borra y sus partidos pasan al que queda. Antes de unir, podés corregir el nombre del que queda.</p>' +
      '<div class="botones-chicos"><button type="button" class="boton" data-accion="unir">Unir</button>' +
      '<button type="button" class="boton boton--borde" data-accion="limpiar">Cancelar</button></div></div>';
  }

  function pintar() {
    vistaActual.querySelector('#lista-arbitros').innerHTML = listaHtml();
    vistaActual.querySelector('#unir-arbitros').innerHTML = unirHtml();
  }

  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    let arbitros;
    try {
      arbitros = await CDM.api.admin.arbitros();
    } catch (err) {
      ctx = null;
      return CDM.admin.barra('Árbitros', acceso.admin, { actual: 'arbitros' }) +
        '<section class="tarjeta vacio"><h2 class="vacio__titulo">Todavía no está la lista de árbitros</h2><p>Falta correr el SQL de esta versión.</p></section>';
    }
    const partidos = await CDM.api.admin.partidos();
    arbitros.forEach((a) => {
      const de = partidos.filter((p) => p.arbitro_id === a.arbitro_id);
      a.partidos = de.length;
      a.ultimo = de.map((p) => p.fecha || '').sort().pop() || '';
    });
    ctx = { arbitros };
    seleccion = seleccion.filter((id) => arbitros.some((a) => a.arbitro_id === id));
    const aviso = CDM.admin.tomarAviso();
    return CDM.admin.barra('Árbitros', acceso.admin, { actual: 'arbitros' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      '<section class="tarjeta" aria-label="Unir árbitros"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Unir árbitros</h2><div id="unir-arbitros">' + unirHtml() + '</div></section>' +
      '<section class="tarjeta" aria-label="Lista de árbitros"><div class="arbitros-cabeza"><div class="campo"><label for="buscar-arb">Buscar</label>' +
      '<input id="buscar-arb" type="search" value="' + e(filtro) + '" placeholder="Nombre o apellido" autocomplete="off"></div>' +
      '<form class="arbitro-nuevo" data-form="arbitro-nuevo"><div class="campo"><label for="arb-nuevo">Árbitro nuevo</label>' +
      '<input id="arb-nuevo" name="nombre" placeholder="Nombre y apellido" autocomplete="off"></div><button type="submit" class="boton boton--borde">+ Árbitro</button></form></div>' +
      '<p class="nota">El nombre se corrige acá y cambia en todos sus partidos. Se guarda al salir del campo.</p>' +
      '<div id="lista-arbitros">' + listaHtml() + '</div></section>';
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function renombrar(input) {
    const li = input.closest('[data-id]');
    const a = ctx.arbitros.find((x) => x.arbitro_id === li.dataset.id);
    const nombre = input.value.trim().replace(/\s+/g, ' ');
    if (!nombre) { input.value = a.nombre; return error('El nombre no puede quedar vacío.'); }
    if (nombre === a.nombre) return;
    const otro = ctx.arbitros.find((x) => x !== a && x.nombre.toLowerCase() === nombre.toLowerCase());
    if (otro) { input.value = a.nombre; return error('Ya hay un árbitro "' + otro.nombre + '". Para juntarlos, usá Unir.'); }
    try {
      await CDM.api.admin.editarArbitro(a.arbitro_id, { nombre });
      a.nombre = nombre;
      input.value = nombre;
      error('');
      const s = li.querySelector('.plantel-estado');
      s.textContent = 'Guardado' + (a.partidos ? ': cambia en ' + ui.plural(a.partidos, 'partido', 'partidos') : '');
      clearTimeout(s._t);
      s._t = setTimeout(() => { s.textContent = ''; }, 4000);
      vistaActual.querySelector('#unir-arbitros').innerHTML = unirHtml();
    } catch (err) {
      input.value = a.nombre;
      error(err.message);
    }
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    vista.addEventListener('input', (ev) => {
      if (ev.target.id === 'buscar-arb') { filtro = ev.target.value; vista.querySelector('#lista-arbitros').innerHTML = listaHtml(); }
    });
    vista.addEventListener('change', (ev) => {
      if (ev.target.matches('[data-nombre]')) return renombrar(ev.target);
      const id = ev.target.dataset.elegir;
      if (!id) return;
      seleccion = ev.target.checked ? seleccion.concat(id).slice(-2) : seleccion.filter((x) => x !== id);
      pintar();
    });
    vista.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.matches('[data-nombre]')) { ev.preventDefault(); ev.target.blur(); }
    });
    vista.addEventListener('click', async (ev) => {
      const par = ev.target.closest('[data-par]');
      if (par) {
        seleccion = par.dataset.par.split('|');
        pintar();
        vista.querySelector('#u-queda').focus();
        return;
      }
      const b = ev.target.closest('[data-accion]');
      if (!b) return;
      if (b.dataset.accion === 'limpiar') { seleccion = []; pintar(); return; }
      if (b.dataset.accion === 'unir') {
        const queda = vista.querySelector('#u-queda').value;
        const sobra = seleccion.find((x) => x !== queda);
        const aq = ctx.arbitros.find((x) => x.arbitro_id === queda);
        const as = ctx.arbitros.find((x) => x.arbitro_id === sobra);
        if (!window.confirm('¿Unir a ' + as.nombre + ' con ' + aq.nombre + '? ' + as.nombre + ' se borra y sus partidos pasan a ' + aq.nombre + '.')) return;
        b.disabled = true;
        try {
          const n = await CDM.api.admin.unirArbitros(queda, sobra);
          seleccion = [];
          CDM.admin.avisar('Unidos: ' + as.nombre + ' pasó a ' + aq.nombre + ' (' + ui.plural(n, 'partido', 'partidos') + ').');
          CDM.router.recargar();
        } catch (err) {
          b.disabled = false;
          error(err.message);
        }
      }
    });
    vista.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-form="arbitro-nuevo"]');
      if (!form) return;
      ev.preventDefault();
      const nombre = form.nombre.value.trim();
      if (!nombre) return error('Escribí el nombre del árbitro.');
      try {
        await CDM.api.admin.crearArbitro(nombre);
        CDM.admin.avisar('Árbitro agregado: ' + nombre + '.');
        CDM.router.recargar();
      } catch (err) {
        error(err.message);
      }
    });
  }

  return { titulo: 'Árbitros', seccion: 'admin', render, montar };
})();
