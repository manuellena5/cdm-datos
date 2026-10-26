// Tablas anchas en el celular (6.6.3, mockups 13 a 16).
// Debajo de 720 px cada fila de la tabla pasa a una fila de dos líneas (una tarjeta chica) con
// "Ordenar por", "Ver los N…" y "Ver tabla completa"; en PC se ve la tabla original, sin cambios.
window.CDM = window.CDM || {};

CDM.filas = (function () {
  const e = CDM.ui.escaparHtml;
  // Orden elegido y "ver todos" por bloque: se mantienen al cambiar los filtros de la pantalla.
  const elegido = new Map();
  let abierta = null;      // { caja, volver } de la tabla completa abierta

  const FLECHA = '<svg class="fila__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';

  // Una fila: { href, escudo, arriba, medio (p. ej. la barra), abajo, claves: { efect: 63, nombre: 'Susanense' } }.
  // arriba y abajo ya vienen como HTML escapado.
  function fila(x) {
    const claves = Object.entries(x.claves || {}).map(([k, v]) => ' data-o-' + k + '="' + e(v ?? '') + '"').join('');
    return '<li' + claves + '><a class="fila" href="' + e(x.href) + '">' + (x.escudo || '') +
      '<span class="fila__cuerpo"><span class="fila__arriba">' + x.arriba + '</span>' + (x.medio || '') +
      (x.abajo ? '<span class="fila__abajo">' + x.abajo + '</span>' : '') + '</span>' + FLECHA + '</a></li>';
  }

  // Número grande al final de la línea de arriba (efectividad, goles…).
  const numero = (v) => '<span class="fila__num">' + e(v) + '</span>';
  // Mini barra de efectividad debajo del nombre.
  const barra = (pct) => '<span class="fila__barra" aria-hidden="true"><span style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></span>';
  // Chips de la segunda línea; los ceros y vacíos no se muestran.
  const chips = (lista) => lista.filter(Boolean).map((t) => '<span class="fila__chip">' + e(t) + '</span>').join('');

  // Bloque completo. o = {
  //   id, titulo (de la tabla completa), tabla (HTML de la tabla original, con su .tabla-scroll),
  //   filas: [fila(...)] o grupos: [{ titulo, filas }] (con un título por grupo; el orden se aplica dentro de cada uno),
  //   ordenes: [{ valor, texto, asc }], limite, verMas: (n) => 'Ver los n rivales' }
  function bloque(o) {
    const ordenes = o.ordenes || [];
    const sel = (elegido.get(o.id) || {}).orden || (ordenes[0] && ordenes[0].valor);
    const control = ordenes.length > 1
      ? '<label class="filas__orden">Ordenar por <select data-filas-orden>' + ordenes.map((x) =>
        '<option value="' + e(x.valor) + '"' + (x.asc ? ' data-asc="1"' : '') + (x.valor === sel ? ' selected' : '') + '>' + e(x.texto) + '</option>').join('') +
        '</select></label>'
      : '<span></span>';
    const filas = o.grupos
      ? o.grupos.flatMap((g) => ['<li class="filas__grupo" data-grupo><h3>' + e(g.titulo) + '</h3><span>' + g.filas.length + '</span></li>'].concat(g.filas))
      : o.filas;
    const total = o.grupos ? o.grupos.reduce((s, g) => s + g.filas.length, 0) : o.filas.length;
    const sobran = o.limite && total > o.limite ? total : 0;
    return '<div class="filas" data-filas="' + e(o.id) + '"' + (o.limite ? ' data-limite="' + o.limite + '"' : '') + '>' +
      '<div class="filas__tabla" data-filas-tabla>' +
        '<div class="filas__cabeza"><span class="filas__titulo">' + e(o.titulo) + '</span>' +
        '<button type="button" class="boton boton--borde" data-filas-cerrar>Cerrar</button></div>' +
        '<p class="filas__nota">Deslizá la tabla hacia el costado. La primera columna queda fija.</p>' +
        o.tabla + '</div>' +
      '<div class="filas__movil">' +
        '<div class="filas__controles">' + control +
        '<button type="button" class="boton boton--borde filas__completa" data-filas-completa>Ver tabla completa</button></div>' +
        '<ol class="filas__lista">' + filas.join('') + '</ol>' +
        (sobran ? '<button type="button" class="boton boton--borde filas__mas" data-filas-mas>' + e(o.verMas(sobran)) + '</button>' : '') +
      '</div></div>';
  }

  function comparar(clave, asc) {
    return (a, b) => {
      const x = a.getAttribute('data-o-' + clave) ?? '';
      const y = b.getAttribute('data-o-' + clave) ?? '';
      const nx = Number(x), ny = Number(y);
      const r = x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), 'es');
      return (asc ? r : -r) || Number(a.dataset.i) - Number(b.dataset.i);
    };
  }

  // Ordena y recorta un bloque según lo elegido.
  function aplicar(caja) {
    const id = caja.dataset.filas;
    const estado = elegido.get(id) || {};
    const lista = caja.querySelector('.filas__lista');
    const items = [...lista.children];
    items.forEach((li, i) => { if (li.dataset.i == null) li.dataset.i = i; });
    const sel = caja.querySelector('[data-filas-orden]');
    if (sel) {
      const op = sel.selectedOptions[0];
      const cmp = comparar(sel.value, op && op.dataset.asc === '1');
      // con grupos, se ordena cada tramo entre títulos
      const orden = [];
      let tramo = [];
      const cerrarTramo = () => { orden.push(...tramo.sort(cmp)); tramo = []; };
      items.forEach((li) => { if (li.hasAttribute('data-grupo')) { cerrarTramo(); orden.push(li); } else tramo.push(li); });
      cerrarTramo();
      orden.forEach((li) => lista.appendChild(li));
    }
    const limite = Number(caja.dataset.limite) || 0;
    const todos = estado.todos || !limite;
    let n = 0;
    [...lista.children].forEach((li) => { if (!li.hasAttribute('data-grupo')) li.hidden = !todos && n++ >= limite; });
    // un título sin filas visibles se esconde
    [...lista.children].forEach((li) => {
      if (!li.hasAttribute('data-grupo')) return;
      let x = li.nextElementSibling, alguna = false;
      while (x && !x.hasAttribute('data-grupo')) { if (!x.hidden) alguna = true; x = x.nextElementSibling; }
      li.hidden = !alguna;
    });
    const mas = caja.querySelector('[data-filas-mas]');
    if (mas) mas.hidden = todos;
  }

  function guardar(caja, cambios) {
    const id = caja.dataset.filas;
    elegido.set(id, Object.assign({}, elegido.get(id), cambios));
  }

  function abrir(caja, boton) {
    const t = caja.querySelector('[data-filas-tabla]');
    t.classList.add('filas__tabla--abierta');
    t.setAttribute('role', 'dialog');
    t.setAttribute('aria-modal', 'true');
    t.setAttribute('aria-label', caja.querySelector('.filas__titulo').textContent);
    document.documentElement.classList.add('sin-scroll');
    abierta = { caja, volver: boton };
    t.querySelector('[data-filas-cerrar]').focus();
  }

  function cerrar() {
    if (!abierta) return;
    const t = abierta.caja.querySelector('[data-filas-tabla]');
    t.classList.remove('filas__tabla--abierta');
    ['role', 'aria-modal', 'aria-label'].forEach((a) => t.removeAttribute(a));
    document.documentElement.classList.remove('sin-scroll');
    const volver = abierta.volver;
    abierta = null;
    if (volver && volver.isConnected) volver.focus();
  }

  // Engancha los bloques de una vista. Se llama desde el montar de cada pantalla.
  function montar(vista) {
    cerrar();
    vista.querySelectorAll('[data-filas]').forEach(aplicar);
    vista.addEventListener('change', (ev) => {
      if (!ev.target.matches('[data-filas-orden]')) return;
      const caja = ev.target.closest('[data-filas]');
      guardar(caja, { orden: ev.target.value });
      aplicar(caja);
    });
    vista.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-filas-mas], [data-filas-completa], [data-filas-cerrar]');
      if (!b) return;
      const caja = b.closest('[data-filas]');
      if (b.matches('[data-filas-mas]')) {
        guardar(caja, { todos: true });
        aplicar(caja);
        const siguiente = [...caja.querySelectorAll('.filas__lista > li:not([data-grupo]) a')][Number(caja.dataset.limite)];
        if (siguiente) siguiente.focus();
      } else if (b.matches('[data-filas-completa]')) {
        abrir(caja, b);
      } else {
        cerrar();
      }
    });
  }

  // Escape cierra; Tab queda dentro de la tabla completa; al cambiar de pantalla se cierra.
  document.addEventListener('keydown', (ev) => {
    if (!abierta) return;
    if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); return; }
    if (ev.key !== 'Tab') return;
    const t = abierta.caja.querySelector('[data-filas-tabla]');
    const focos = [...t.querySelectorAll('a[href], button, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
    if (!focos.length) return;
    const primero = focos[0], ultimo = focos[focos.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
    else if (!t.contains(document.activeElement)) { ev.preventDefault(); primero.focus(); }
  });
  window.addEventListener('hashchange', () => { if (abierta) { abierta.volver = null; cerrar(); } });

  return { bloque, fila, numero, barra, chips, montar };
})();
