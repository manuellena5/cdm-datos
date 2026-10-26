// Jugador en modo administrador (#/admin/jugadores/J060?cat=P) — PLAN 6.6.4, mockup 17.
// A la izquierda, los datos del jugador (con el puesto habitual); a la derecha, "Torneos que jugó":
// cada casillero suma o saca al jugador de la lista de ese torneo (tabla planteles), la misma que usa
// Administrar → Planteles. Lo que tiene goles, tarjetas o formación siempre cuenta y no se quita desde acá.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminJugador = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  const num = (v) => Number(v || 0);
  const nombre = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');
  let ctx = null;
  let vistaActual = null;

  // [2011, 2012, 2013, 2016] → '2011–2013, 2016'
  function rangos(anios) {
    const a = [...new Set(anios)].sort((x, y) => x - y);
    const partes = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      partes.push(i === j ? String(a[i]) : a[i] + '–' + a[j]);
      i = j;
    }
    return partes.join(', ');
  }

  // Lo que se muestra en un casillero con datos: goles, si no rojas, si no la formación, si no amarillas
  function textoDatos(x) {
    if (num(x.goles)) return ui.plural(num(x.goles), 'gol', 'goles');
    if (num(x.rojas)) return ui.plural(num(x.rojas), 'roja', 'rojas');
    if (num(x.titular) + num(x.entro) + num(x.convocado)) return num(x.presencias) + ' en la lista';
    if (num(x.amarillas)) return ui.plural(num(x.amarillas), 'amarilla', 'amarillas');
    return 'Con datos';
  }

  // Estado de cada torneo de la categoría: datos | lista | jugo | vacio
  function estados() {
    const filas = ctx.filas.filter((x) => x.categoria === ctx.categoria);
    const de = Object.fromEntries(filas.map((x) => [x.torneo_id, x]));
    const conDatos = filas.filter((x) => num(x.presencias) > 0).map((x) => x.torneo_orden);
    const desde = Math.min(...conDatos);
    const hasta = Math.max(...conDatos);
    const r = {};
    ctx.torneos.forEach((t) => {
      const x = de[t.torneo_id];
      if (x && num(x.presencias) > 0) r[t.torneo_id] = { estado: 'datos', texto: textoDatos(x) };
      else if (x && x.en_lista) r[t.torneo_id] = { estado: 'lista', texto: 'En la lista' };
      else if (conDatos.length && t.orden > desde && t.orden < hasta) r[t.torneo_id] = { estado: 'jugo', texto: '¿Jugó?' };
      else r[t.torneo_id] = { estado: 'vacio', texto: '—' };
    });
    return r;
  }

  function casillero(t, s, varios) {
    const etiqueta = t.nombre + ': ' + {
      datos: 'con datos (' + s.texto + '), no se puede quitar', lista: 'en la lista, tocá para sacarlo',
      jugo: '¿jugó? Tocá para sumarlo', vacio: 'no está, tocá para sumarlo'
    }[s.estado];
    return '<button type="button" class="casillero casillero--' + s.estado + '" data-torneo="' + e(t.torneo_id) + '" aria-pressed="' +
      (s.estado === 'datos' || s.estado === 'lista') + '"' + (s.estado === 'datos' ? ' aria-disabled="true"' : '') +
      ' aria-label="' + e(etiqueta) + '" title="' + e(t.nombre) + '">' +
      (varios ? '<span class="casillero__torneo">' + e(ui.torneoSinAnio(t.nombre)) + '</span>' : '') +
      (s.estado === 'datos' || s.estado === 'lista' ? '<span class="casillero__check" aria-hidden="true">✓</span>' : '') +
      '<span class="casillero__texto">' + e(s.texto) + '</span></button>';
  }

  function grillaHtml() {
    const st = estados();
    const cuenta = (k) => Object.values(st).filter((s) => s.estado === k).length;
    const n = { datos: cuenta('datos'), lista: cuenta('lista'), jugo: cuenta('jugo') };
    const anios = ctx.torneos.map((t) => t.anio);
    const hayCopa = ctx.torneos.some((t) => t.tipo === 'Copa');
    const celda = (lista, clase) => '<td' + (clase ? ' class="' + clase + '"' : '') + '>' + (lista.length ? lista.map((t) => casillero(t, st[t.torneo_id], lista.length > 1)).join('')
      : '<span class="grilla__no" aria-label="Sin torneo">—</span>') + '</td>';
    let filas = '';
    for (let a = Math.max(...anios); a >= Math.min(...anios); a--) {
      const delAnio = ctx.torneos.filter((t) => t.anio === a);
      if (!delAnio.length) {
        filas += '<tr><th scope="row">' + a + '</th><td colspan="' + (hayCopa ? 3 : 2) + '" class="grilla__sin">Sin torneos</td></tr>';
        continue;
      }
      const liga = delAnio.filter((t) => t.tipo !== 'Copa');
      filas += '<tr><th scope="row">' + a + '</th>' + celda(liga.filter((t) => filtros.sufijo(t.torneo_id) !== 'C')) +
        celda(liga.filter((t) => filtros.sufijo(t.torneo_id) === 'C')) + (hayCopa ? celda(delAnio.filter((t) => t.tipo === 'Copa'), 'grilla__copa') : '') + '</tr>';
    }
    return '<div class="grilla__resumen"><span>' + e([ui.plural(n.datos, 'con datos', 'con datos'),
      ui.plural(n.lista, 'marcado a mano', 'marcados a mano'), ui.plural(n.jugo, 'para confirmar', 'para confirmar')].join(' · ')) + '</span>' +
      (n.jugo ? '<button type="button" class="boton boton--borde" data-accion="marcar-jugo">Marcar ' + (n.jugo === 1 ? 'el' : 'los ' + n.jugo) + '</button>' : '') + '</div>' +
      '<table class="grilla"><thead><tr><th scope="col">Año</th><th scope="col">Apertura</th><th scope="col">Clausura</th>' +
      (hayCopa ? '<th scope="col" class="grilla__copa">Copa</th>' : '') + '</tr></thead><tbody>' + filas + '</tbody></table>';
  }

  function resumenHtml() {
    const j = ctx.jugador;
    const partes = ['Primera', 'Reserva'].map((cat) => {
      const de = ctx.filas.filter((x) => x.categoria === cat && num(x.presencias) > 0);
      const goles = de.reduce((s, x) => s + num(x.goles), 0);
      return de.length ? '<span><strong>' + e(ui.plural(goles, 'gol', 'goles')) + '</strong> en ' + cat + ' (' + e(rangos(de.map((x) => x.anio))) + ')</span>' : '';
    }).filter(Boolean);
    const suma = (k) => ctx.filas.reduce((s, x) => s + num(x[k]), 0);
    const formacion = suma('titular') + suma('entro') + suma('convocado');
    const otros = [suma('rojas') ? ui.plural(suma('rojas'), 'roja', 'rojas') : '', suma('amarillas') ? ui.plural(suma('amarillas'), 'amarilla', 'amarillas') : '',
      ui.plural(formacion, 'partido con formación', 'partidos con formación')].filter(Boolean).join(' · ');
    return '<div class="jugador-admin__resumen">' + (partes.length ? partes.join('') : '<span>Sin goles, tarjetas ni formación cargados</span>') +
      '<span>' + e(otros) + '</span><a class="enlace" href="#/jugador/' + encodeURIComponent(j.jugador_id) + '">Ver ficha pública</a></div>';
  }

  function datosHtml() {
    const j = ctx.jugador;
    const campo = (k, etiqueta, extra) => '<div class="campo"><label for="ja-' + k + '">' + etiqueta + '</label>' +
      '<input id="ja-' + k + '" name="' + k + '" value="' + e(j[k] || '') + '" autocomplete="off"' + (extra || '') + '></div>';
    const opcion = (v, t) => '<option value="' + e(v) + '"' + ((j.posicion || '') === v ? ' selected' : '') + '>' + e(t) + '</option>';
    return '<section class="tarjeta jugador-admin__datos" aria-label="Datos del jugador">' +
      '<nav class="migas" aria-label="Ruta"><a href="' + e(ctx.volver || '#/admin/jugadores') + '">' + (ctx.volver ? 'Volver' : 'Jugadores') + '</a> › ' + e(nombre(j)) + '</nav>' +
      '<h1 class="jugador-admin__nombre" id="ja-titulo">' + e(nombre(j)) + '</h1>' +
      '<div class="fila-2">' + campo('apellido', 'Apellido') + campo('nombre', 'Nombre') + '</div>' +
      '<div class="campo"><label for="ja-posicion">Puesto habitual</label><select id="ja-posicion" name="posicion">' + opcion('', '—') +
      ui.PUESTOS.map((p) => opcion(p, p)).join('') + '</select></div>' +
      '<p class="nota">Se usa en los planteles. En un torneo puntual se puede cambiar desde Planteles.</p>' +
      campo('apodo', 'Apodo', ' placeholder="Opcional"') +
      '<div class="campo"><label for="ja-notas">Notas</label><textarea id="ja-notas" name="notas" rows="2">' + e(j.notas || '') + '</textarea></div>' +
      '<p class="plantel-estado" id="ja-estado" role="status"></p>' + resumenHtml() + '</section>';
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const api = CDM.api.admin;
    const [resumen, torneos, filas] = await Promise.all([api.jugadoresResumen(), api.torneos(), api.plantelJugador(params.id)]);
    const jugador = resumen.find((j) => j.jugador_id === params.id);
    if (!jugador) {
      ctx = null;
      return CDM.admin.barra('Jugadores', acceso.admin, { actual: 'jugadores' }) +
        '<section class="tarjeta vacio"><h2 class="vacio__titulo">No encontramos este jugador</h2><p><a href="#/admin/jugadores">Ir a Jugadores</a></p></section>';
    }
    const pedida = query.get('cat');
    const cat = pedida === 'R' || pedida === 'P' ? pedida
      : (jugador.division === 'Reserva' || (!filas.some((x) => x.categoria === 'Primera') && filas.some((x) => x.categoria === 'Reserva')) ? 'R' : 'P');
    const volver = /^#\/admin\//.test(query.get('volver') || '') ? query.get('volver') : null;
    ctx = { jugador, torneos: torneos.slice().sort((a, b) => b.orden - a.orden), filas, cat, categoria: filtros.nombreCategoria(cat), volver };

    return CDM.admin.barra('Jugadores', acceso.admin, { actual: 'jugadores' }) +
      '<p class="form-error" role="alert" hidden></p>' +
      '<div class="jugador-admin">' + datosHtml() +
      '<section class="tarjeta jugador-admin__torneos" aria-label="Torneos que jugó"><div class="jugador-admin__cabeza"><h2 class="tarjeta__titulo">Torneos que jugó</h2>' +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) + '</div>' +
      '<p class="nota">Tocá un torneo para sumarlo o sacarlo de la lista de ese plantel. Lo que se marca acá aparece en Planteles, y al revés.</p>' +
      '<ul class="grilla__leyenda"><li><span class="casillero casillero--datos casillero--muestra"></span>Con datos (goles, tarjetas, formación): siempre está</li>' +
      '<li><span class="casillero casillero--lista casillero--muestra"></span>En la lista, marcado a mano</li>' +
      '<li><span class="casillero casillero--jugo casillero--muestra"></span>¿Jugó? Entre dos torneos con datos</li></ul>' +
      '<p class="plantel-estado" id="grilla-estado" role="status"></p>' +
      '<div id="grilla">' + grillaHtml() + '</div></section></div>';
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function estado(id, texto) {
    const s = vistaActual.querySelector('#' + id);
    if (!s) return;
    s.textContent = texto;
    clearTimeout(s._t);
    s._t = setTimeout(() => { s.textContent = ''; }, 5000);
  }

  function pintarGrilla(foco) {
    vistaActual.querySelector('#grilla').innerHTML = grillaHtml();
    const b = foco && vistaActual.querySelector('[data-torneo="' + CSS.escape(foco) + '"]');
    if (b) b.focus();
  }

  const filaNueva = (t) => ({ torneo_id: t.torneo_id, torneo_orden: t.orden, anio: t.anio, categoria: ctx.categoria, en_lista: true, presencias: 0 });

  async function tocar(boton) {
    const t = ctx.torneos.find((x) => x.torneo_id === boton.dataset.torneo);
    const s = estados()[t.torneo_id];
    if (s.estado === 'datos') return estado('grilla-estado', 'Tiene datos en el ' + t.nombre + ': siempre está en ese plantel.');
    boton.disabled = true;
    const id = ctx.jugador.jugador_id;
    try {
      if (s.estado === 'lista') {
        await CDM.api.admin.quitarDeLista(t.torneo_id, ctx.categoria, id);
        ctx.filas = ctx.filas.filter((x) => !(x.torneo_id === t.torneo_id && x.categoria === ctx.categoria));
        estado('grilla-estado', 'Sacado del ' + t.nombre + '.');
      } else {
        await CDM.api.admin.guardarLista([{ torneo_id: t.torneo_id, categoria: ctx.categoria, jugador_id: id }]);
        ctx.filas.push(filaNueva(t));
        estado('grilla-estado', 'Sumado al ' + t.nombre + '.');
      }
      error('');
      pintarGrilla(t.torneo_id);
    } catch (err) {
      boton.disabled = false;
      error(err.message);
    }
  }

  async function marcarJugo(boton) {
    const st = estados();
    const ts = ctx.torneos.filter((t) => st[t.torneo_id].estado === 'jugo');
    if (!ts.length) return;
    boton.disabled = true;
    try {
      await CDM.api.admin.guardarLista(ts.map((t) => ({ torneo_id: t.torneo_id, categoria: ctx.categoria, jugador_id: ctx.jugador.jugador_id })));
      ts.forEach((t) => ctx.filas.push(filaNueva(t)));
      error('');
      pintarGrilla();
      estado('grilla-estado', 'Sumado a ' + ui.plural(ts.length, 'torneo', 'torneos') + '.');
    } catch (err) {
      boton.disabled = false;
      error(err.message);
    }
  }

  // Los datos del jugador se guardan solos al salir de cada campo
  async function guardarDato(el) {
    const j = ctx.jugador;
    const v = el.value.trim();
    if (el.name === 'apellido' && !v) { error('El apellido no puede quedar vacío.'); el.value = j.apellido; return; }
    if ((j[el.name] || '') === v) return;
    try {
      await CDM.api.admin.editarJugador(j.jugador_id, { [el.name]: v || null });
      j[el.name] = v || null;
      error('');
      vistaActual.querySelector('#ja-titulo').textContent = nombre(j);
      estado('ja-estado', el.name === 'posicion' ? 'Guardado. Los planteles sin puesto lo ponen como ' + (v || 'sin puesto') + '.' : 'Guardado.');
    } catch (err) {
      error(err.message);
    }
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    const h1 = vista.querySelector('#ja-titulo');
    if (h1) document.title = h1.textContent + ' · Historial Mitre';
    vista.addEventListener('change', (ev) => {
      if (ev.target.closest('.jugador-admin__datos') && ev.target.name) guardarDato(ev.target);
    });
    vista.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.closest('.jugador-admin__datos')) { ev.preventDefault(); ev.target.blur(); }
    });
    vista.addEventListener('click', (ev) => {
      const seg = ev.target.closest('[data-seg="cat"]');
      if (seg) return CDM.router.cambiarFiltros('/admin/jugadores/' + encodeURIComponent(ctx.jugador.jugador_id), { cat: seg.dataset.valor, volver: ctx.volver || undefined });
      const b = ev.target.closest('[data-torneo]');
      if (b) return tocar(b);
      const m = ev.target.closest('[data-accion="marcar-jugo"]');
      if (m) marcarJugo(m);
    });
  }

  return { titulo: 'Jugador', seccion: 'admin', render, montar };
})();
