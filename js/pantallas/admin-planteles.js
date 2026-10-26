// Plantel del torneo en tabla (#/admin/planteles?anio=2014&torneo=A&cat=P) — PLAN 6.5.2, mockup 10.
// Una fila por jugador: los que tienen datos en el torneo (goles, tarjetas, formación) y los de la lista cargada.
// Apellido, nombre y apodo corrigen al jugador; el puesto queda en la lista del torneo. Todo se guarda solo, fila por fila.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminPlanteles = (function () {
  const { ui, filtros } = CDM;
  const e = ui.escaparHtml;
  const PUESTOS = ['Arquero', 'Defensor', 'Volante', 'Delantero'];
  let ctx = null;
  let vistaActual = null;

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
  const nombre = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');
  const soloInicial = (n) => !n || /^\p{L}\.?$/u.test(String(n).trim()) || /^(\p{L}\.\s*)+$/u.test(String(n).trim());
  const tituloCaso = (t) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : t);
  const num = (v) => Number(v || 0);

  // [2011, 2012, 2013, 2016] → '2011–2013, 2016'
  function rangos(anios) {
    const a = [...new Set(anios || [])].sort((x, y) => x - y);
    const partes = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      partes.push(i === j ? String(a[i]) : a[i] + '–' + a[j]);
      i = j;
    }
    return partes.join(', ');
  }

  // ---------- Datos ----------
  // Filas del plantel: los que tienen datos en el torneo y los de la lista.
  function armarFilas() {
    const filas = new Map();
    // las estadísticas también traen a los de la lista: sin datos, solo cuentan si siguen en la lista
    ctx.estadisticas.forEach((x) => { if (num(x.presencias) > 0 || ctx.lista.some((l) => l.jugador_id === x.jugador_id)) filas.set(x.jugador_id, x); });
    ctx.lista.forEach((l) => { if (!filas.has(l.jugador_id)) filas.set(l.jugador_id, { jugador_id: l.jugador_id, en_lista: true }); });
    return [...filas.values()].map((x) => {
      const j = ctx.porId[x.jugador_id] || { apellido: '?', nombre: '' };
      const l = ctx.lista.find((y) => y.jugador_id === x.jugador_id);
      const formacion = num(x.titular) + num(x.entro) + num(x.convocado);
      const motivos = [];
      if (num(x.goles)) motivos.push(num(x.rojas) ? 'Goles y roja' : 'Goles');
      else if (num(x.rojas)) motivos.push('Roja');
      if (formacion) motivos.push('Formación');
      if (!motivos.length && num(x.presencias)) motivos.push('Incidencia');
      if (!motivos.length) motivos.push(ctx.nuevos.has(x.jugador_id) ? 'Nuevo' : 'Lista cargada');
      return {
        jugador_id: x.jugador_id, j, goles: num(x.goles), rojas: num(x.rojas),
        conDatos: num(x.presencias) > 0, enLista: !!l, puesto: l ? l.posicion || '' : '', camiseta: l ? l.camiseta : null,
        motivos: motivos.join(' · ')
      };
    }).sort((a, b) => b.goles - a.goles || b.rojas - a.rojas || nombre(a.j).localeCompare(nombre(b.j), 'es'));
  }

  // Para revisar: sin nombre, o mismo apellido que otro jugador cuando a uno le falta el nombre o tiene solo la inicial.
  function revisar(j) {
    if (!j.nombre) {
      const otro = ctx.jugadores.find((x) => x.jugador_id !== j.jugador_id && norm(x.apellido) === norm(j.apellido));
      return { texto: 'Falta el nombre', par: otro ? otro.jugador_id : null, otro };
    }
    const otro = ctx.jugadores.find((x) => x.jugador_id !== j.jugador_id && norm(x.apellido) === norm(j.apellido) &&
      (soloInicial(x.nombre) || soloInicial(j.nombre)));
    return otro ? { texto: '¿Mismo que ' + nombre(otro) + '?', par: otro.jugador_id, otro } : null;
  }

  function enlaceDuplicado(a, b) {
    return CDM.router.armar('/admin/jugadores/duplicados', { a, b });
  }

  // ---------- HTML ----------
  const opcion = (v, t, actual) => '<option value="' + e(v) + '"' + (String(v) === String(actual ?? '') ? ' selected' : '') + '>' + e(t) + '</option>';
  const selectorPuesto = (valor, extra) => '<select data-campo="puesto"' + (extra || '') + ' aria-label="Puesto">' + opcion('', '—', valor) +
    PUESTOS.map((p) => opcion(p, p, valor)).join('') + '</select>';

  function filaHtml(f) {
    const r = revisar(f.j);
    return '<tr data-id="' + e(f.jugador_id) + '"' + (r ? ' class="plantel-fila--revisar"' : '') + '>' +
      '<td class="centro"><input type="checkbox" data-campo="incluido" checked' + (f.conDatos ? ' disabled title="Tiene datos en este torneo: está en el plantel"' : '') +
      ' aria-label="En el plantel: ' + e(nombre(f.j)) + '"></td>' +
      (ctx.hayCamisetas ? '<td><input type="number" min="0" max="99" inputmode="numeric" data-campo="camiseta" value="' + (f.camiseta ?? '') + '" aria-label="Camiseta" class="plantel-num"></td>' : '') +
      '<td><input data-campo="apellido" value="' + e(f.j.apellido) + '" aria-label="Apellido" autocomplete="off">' +
      (r ? '<div class="plantel-aviso">' + e(r.texto) + (r.par ? ' <a href="' + enlaceDuplicado(f.jugador_id, r.par) + '">Revisar</a>' : '') + '</div>' : '') +
      '<div class="plantel-estado" role="status"></div></td>' +
      '<td><input data-campo="nombre" value="' + e(f.j.nombre || '') + '" placeholder="Nombre" aria-label="Nombre" autocomplete="off"></td>' +
      '<td>' + selectorPuesto(f.puesto) + '</td>' +
      '<td><input data-campo="apodo" value="' + e(f.j.apodo || '') + '" placeholder="Apodo" aria-label="Apodo" autocomplete="off"></td>' +
      '<td class="centro">' + (f.goles || '·') + '</td><td class="centro">' + (f.rojas || '·') + '</td>' +
      '<td><span class="etiqueta etiqueta--' + (f.motivos === 'Nuevo' ? 'ok' : 'info') + '">' + e(f.motivos) + '</span></td>' +
      '<td>' + (f.conDatos ? '' : '<button type="button" class="boton-icono boton-icono--chico" data-quitar="' + e(f.jugador_id) + '" aria-label="Quitar a ' + e(nombre(f.j)) + ' del plantel">✕</button>') + '</td></tr>';
  }

  function filaNuevaHtml() {
    return '<tr class="plantel-nueva" data-nueva="1"><td></td>' + (ctx.hayCamisetas ? '<td></td>' : '') +
      '<td class="plantel-nueva__apellido"><input data-nuevo="apellido" placeholder="Apellido" aria-label="Apellido del jugador a agregar" autocomplete="off">' +
      '<div class="sugerencias" role="listbox" aria-label="Jugadores parecidos" hidden></div></td>' +
      '<td><input data-nuevo="nombre" placeholder="Nombre" aria-label="Nombre" autocomplete="off"></td>' +
      '<td>' + selectorPuesto('', ' data-nuevo="puesto"') + '</td>' +
      '<td><input data-nuevo="apodo" placeholder="Apodo" aria-label="Apodo" autocomplete="off"></td><td></td><td></td>' +
      '<td><span class="etiqueta etiqueta--ok">Nuevo</span></td><td></td></tr>';
  }

  function sugeridosHtml() {
    if (!ctx.anterior) return '';
    const ids = new Set(ctx.filas.map((f) => f.jugador_id));
    const sug = ctx.estAnterior.filter((x) => !ids.has(x.jugador_id) && ctx.porId[x.jugador_id])
      .sort((a, b) => num(b.goles) - num(a.goles) || num(b.partidos) - num(a.partidos));
    if (!sug.length) return '';
    const dato = (x) => [num(x.goles) ? ui.plural(num(x.goles), 'gol', 'goles') : '', num(x.rojas) ? ui.plural(num(x.rojas), 'roja', 'rojas') : '',
      num(x.titular) + num(x.entro) + num(x.convocado) ? 'formación' : '', x.en_lista && !num(x.presencias) ? 'lista' : ''].filter(Boolean).join(' · ');
    return '<h3 class="plantel-sub">Sugeridos · ' + e(ctx.anterior.nombre) + ', sin datos en este torneo</h3>' +
      '<div class="tabla-scroll"><table class="tabla tabla--sugeridos"><tbody>' + sug.map((x) => {
        const j = ctx.porId[x.jugador_id];
        return '<tr><td class="centro"><input type="checkbox" data-marcar="' + e(x.jugador_id) + '" aria-label="Sumar a ' + e(nombre(j)) + '"></td>' +
          '<td><strong>' + e(j.apellido) + '</strong>' + (j.nombre ? ', ' + e(j.nombre) : '') + '</td>' +
          '<td class="texto-2">' + e(dato(x)) + '</td>' +
          '<td><button type="button" class="boton boton--borde" data-sumar="' + e(x.jugador_id) + '">Sumar</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<button type="button" class="boton boton--borde" data-accion="sumar-marcados">Sumar los marcados</button>';
  }

  // ---------- Pegar lista ----------
  // "Aguirre, Diego, Delantero" · "9. RUIZ DIAZ, Gabriel" · columnas de Excel (tab o ;) · "Ruiz Díaz Gabriel"
  function leerLinea(linea) {
    let t = linea.trim();
    if (!t || /apellido|nombre|jugador/i.test(t) && !/\d/.test(t) && t.split(/[,;\t]/).length > 1) return null;
    let camiseta = null;
    let partes = t.split(/[;\t]/).map((x) => x.trim()).filter(Boolean);
    if (partes.length < 2 && t.includes(',')) partes = t.split(',').map((x) => x.trim()).filter(Boolean);
    const m = (partes[0] || '').match(/^(\d{1,2})[\s.\-)]+(.*)$/);
    if (m) { camiseta = Number(m[1]); partes[0] = m[2]; }
    const num0 = partes.findIndex((x) => /^\d{1,2}$/.test(x));
    if (num0 >= 0) camiseta = Number(partes.splice(num0, 1)[0]);
    const puestoI = partes.findIndex((x, i) => i >= 1 && PUESTOS.some((p) => norm(p) === norm(x)));
    let puesto = '';
    if (puestoI >= 0) {
      const escrito = norm(partes.splice(puestoI, 1)[0]);
      puesto = PUESTOS.find((p) => norm(p) === escrito);
    }
    if (partes.length >= 2) return { camiseta, puesto, apellido: tituloCaso(partes[0]), nombre: tituloCaso(partes[1]) };
    const tokens = (partes[0] || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    if (tokens.length === 1) return { camiseta, puesto, apellido: tituloCaso(tokens[0]), nombre: '' };
    // Sin coma: "Apellido Nombre" (el nombre es la última palabra)
    return { camiseta, puesto, apellido: tituloCaso(tokens.slice(0, -1).join(' ')), nombre: tituloCaso(tokens[tokens.length - 1]) };
  }

  function reconocer(l) {
    const ap = norm(l.apellido), no = norm(l.nombre), juntos = norm(l.apellido + ' ' + l.nombre);
    const compatible = (jn, x) => jn === x || jn.startsWith(x) || x.startsWith(jn) || jn.split(' ')[0] === x.split(' ')[0];
    const seguros = ctx.jugadores.filter((j) => (norm(j.apellido) === ap && norm(j.nombre) && no && compatible(norm(j.nombre), no)) ||
      (j.nombre && (norm(j.apellido + ' ' + j.nombre) === juntos || norm(j.nombre + ' ' + j.apellido) === juntos)));
    if (seguros.length === 1) return { tipo: 'existe', jugador: seguros[0], opciones: seguros };
    const parecidos = seguros.length ? seguros : ctx.jugadores.filter((j) => norm(j.apellido) === ap);
    if (parecidos.length) return { tipo: 'parecido', jugador: parecidos[0], opciones: parecidos };
    return { tipo: 'nuevo', jugador: null, opciones: [] };
  }

  function previsualizar(texto) {
    const ids = new Set(ctx.filas.map((f) => f.jugador_id));
    ctx.pegado = texto.split(/\r?\n/).map(leerLinea).filter(Boolean).map((l) => {
      const r = reconocer(l);
      return Object.assign(l, r, { elegido: r.jugador ? r.jugador.jugador_id : '__nuevo', yaEsta: !!(r.jugador && r.tipo === 'existe' && ids.has(r.jugador.jugador_id)) });
    });
  }

  function pegadoHtml() {
    const p = ctx.pegado;
    if (!p) return '';
    if (!p.length) return '<p class="aviso-suave">No se reconoció ningún jugador.</p>';
    const items = p.map((l, i) => {
      const texto = l.apellido + (l.nombre ? ', ' + l.nombre : '') + (l.puesto ? ' · ' + l.puesto : '');
      let estado;
      if (l.yaEsta) estado = 'ya está en el plantel';
      else if (l.tipo === 'existe') estado = 'existe' + (norm(nombre(l.jugador)) !== norm(l.apellido + (l.nombre ? ', ' + l.nombre : '')) ? ' como ' + nombre(l.jugador) : '') + (ctx.anios[l.jugador.jugador_id] ? ' (' + ctx.anios[l.jugador.jugador_id] + ')' : '') + ', se suma';
      else if (l.tipo === 'nuevo') estado = 'nuevo, se crea';
      else estado = 'parecido a otro: ¿es alguno de estos?';
      return '<li class="pegado__item pegado__item--' + (l.yaEsta ? 'esta' : l.tipo) + '"><div><strong>' + e(texto) + '</strong> · ' + e(estado) + '</div>' +
        (l.tipo === 'parecido' ? '<select data-pegado="' + i + '" aria-label="Elegir jugador">' + l.opciones.map((j) =>
          opcion(j.jugador_id, nombre(j) + (ctx.anios[j.jugador_id] ? ' (' + ctx.anios[j.jugador_id] + ')' : ''), l.elegido)).join('') +
          opcion('__nuevo', 'No, es otro: crear jugador nuevo', l.elegido) + '</select>' : '') + '</li>';
    }).join('');
    const suman = p.filter((l) => !l.yaEsta).length;
    return '<ul class="pegado">' + items + '</ul>' + (suman
      ? '<button type="button" class="boton" data-accion="sumar-pegado">Sumar ' + suman + ' al plantel</button>'
      : '<p class="nota">Ya están todos en el plantel.</p>');
  }

  // ---------- Pantalla ----------
  function pintarTabla() {
    ctx.filas = armarFilas();
    const t = vistaActual.querySelector('#plantel-tabla');
    if (t) t.innerHTML = ctx.filas.map(filaHtml).join('') + filaNuevaHtml();
    const s = vistaActual.querySelector('#plantel-sugeridos');
    if (s) s.innerHTML = sugeridosHtml();
    const c = vistaActual.querySelector('#plantel-cuenta');
    if (c) c.textContent = cuenta();
  }

  function cuenta() {
    const revisarN = ctx.filas.filter((f) => revisar(f.j)).length;
    return ui.plural(ctx.filas.length, 'jugador', 'jugadores') + (revisarN ? ' · ' + revisarN + ' con algo para revisar' : '') + ' · Los cambios se guardan solos';
  }

  async function cargar(torneo, categoria) {
    const api = CDM.api.admin;
    const anteriorT = ctx.torneosOrden.filter((t) => t.orden < torneo.orden).pop() || null;
    const [lista, estadisticas, estAnterior] = await Promise.all([
      api.listaPlantel(torneo.torneo_id, categoria), api.plantelTorneo(torneo.torneo_id, categoria),
      anteriorT ? api.plantelTorneo(anteriorT.torneo_id, categoria) : Promise.resolve([])
    ]);
    Object.assign(ctx, { torneo, categoria, lista, estadisticas, anterior: anteriorT, estAnterior });
    ctx.hayCamisetas = lista.some((l) => l.camiseta != null);
  }

  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const api = CDM.api.admin;
    const [torneos, jugadores] = await Promise.all([api.torneos(), api.jugadoresResumen()]);
    const comoCampanas = torneos.map((t) => ({ torneo_id: t.torneo_id, anio: t.anio, torneo: t.nombre, torneo_tipo: t.tipo, torneo_orden: t.orden }));
    const elegido = filtros.elegirTorneo(comoCampanas, query);
    const delAnio = filtros.torneos(comoCampanas).filter((t) => t.anio === elegido.anio);
    const letra = elegido.letra === 'todo' ? delAnio[delAnio.length - 1].letra : elegido.letra;
    const torneo = torneos.find((t) => t.anio === elegido.anio && filtros.sufijo(t.torneo_id) === letra);
    const cat = filtros.categoria(query);
    ctx = {
      admin: acceso.admin, torneos, comoCampanas, jugadores, cat, letra, anio: elegido.anio,
      porId: Object.fromEntries(jugadores.map((j) => [j.jugador_id, j])),
      anios: Object.fromEntries(jugadores.map((j) => [j.jugador_id, rangos(j.anios)])),
      torneosOrden: torneos.slice().sort((a, b) => a.orden - b.orden),
      nuevos: new Set(), pegado: null
    };
    await cargar(torneo, filtros.nombreCategoria(cat));
    ctx.filas = armarFilas();
    const aviso = CDM.admin.tomarAviso();
    const otros = ctx.torneosOrden.slice().reverse().filter((t) => t.torneo_id !== torneo.torneo_id);

    return CDM.admin.barra('Planteles', acceso.admin, { actual: 'planteles' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<section class="filtros" aria-label="Filtros">' +
      ui.selector('anio', 'Año', [...new Set(torneos.map((t) => t.anio))].sort((a, b) => b - a).map((a) => ({ valor: a, texto: a })), elegido.anio) +
      ui.selector('torneo', 'Torneo', filtros.opcionesTorneo(comoCampanas, elegido.anio).filter((o) => o.valor !== 'todo'), letra) +
      ui.segmentado('cat', 'Categoría', [{ valor: 'P', texto: 'Primera' }, { valor: 'R', texto: 'Reserva' }], cat) +
      '<div class="campo"><label for="copiar-de">Copiar plantel de</label><div class="copiar">' +
      '<select id="copiar-de">' + otros.map((t) => opcion(t.torneo_id, t.nombre, ctx.anterior ? ctx.anterior.torneo_id : '')).join('') + '</select>' +
      '<button type="button" class="boton boton--borde" data-accion="copiar">Copiar</button></div></div></section>' +
      '<p class="form-error" role="alert" hidden></p>' +
      '<div class="plantel-layout">' +
      '<section class="tarjeta plantel" aria-label="Plantel"><div class="tarjeta__cabeza"><h2 class="tarjeta__titulo">Plantel ' + e(torneo.nombre + ' · ' + ctx.categoria) + '</h2>' +
      '<span class="texto-2" id="plantel-cuenta">' + e(cuenta()) + '</span></div>' +
      '<div class="tabla-scroll"><table class="tabla tabla--plantel-admin"><thead><tr><th><span class="oculto">En plantel</span></th>' +
      (ctx.hayCamisetas ? '<th>N°</th>' : '') + '<th>Apellido</th><th>Nombre</th><th>Puesto</th><th>Apodo</th><th class="centro">Goles</th><th class="centro">Rojas</th>' +
      '<th>Por qué está</th><th><span class="oculto">Acciones</span></th></tr></thead>' +
      '<tbody id="plantel-tabla">' + ctx.filas.map(filaHtml).join('') + filaNuevaHtml() + '</tbody></table></div>' +
      '<button type="button" class="boton boton--borde" data-accion="agregar-fila">+ Agregar fila</button>' +
      '<div id="plantel-sugeridos">' + sugeridosHtml() + '</div></section>' +
      '<aside class="tarjeta pegar" aria-label="Pegar lista"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Pegar lista o CSV</h2>' +
      '<p class="nota">Un jugador por línea: apellido, nombre y puesto (opcional). También sirve copiar columnas desde Excel o subir un .txt/.csv.</p>' +
      '<div class="campo"><label for="pegar-texto">Lista</label><textarea id="pegar-texto" rows="6" placeholder="Aguirre, Diego, Delantero&#10;Rubiolo, Matías"></textarea></div>' +
      '<div class="botones-chicos"><button type="button" class="boton boton--borde" data-accion="previsualizar">Previsualizar</button>' +
      '<label class="boton boton--borde boton-archivo">Subir archivo<input type="file" accept=".txt,.csv,text/plain,text/csv" id="pegar-archivo" class="oculto"></label></div>' +
      '<div id="pegado"></div></aside></div>';
  }

  // ---------- Acciones ----------
  function estadoFila(tr, texto) {
    const s = tr && tr.querySelector('.plantel-estado');
    if (!s) return;
    s.textContent = texto;
    clearTimeout(s._t);
    s._t = setTimeout(() => { s.textContent = ''; }, 4000);
  }

  function error(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const filaLista = (id, extra) => Object.assign({ torneo_id: ctx.torneo.torneo_id, categoria: ctx.categoria, jugador_id: id }, extra || {});

  async function sumar(ids, extra) {
    const nuevos = ids.filter((id) => !ctx.lista.some((l) => l.jugador_id === id));
    if (nuevos.length) {
      // Todas las filas con las mismas columnas (la carga en lote lo necesita)
      const claves = [...new Set(nuevos.flatMap((id) => Object.keys((extra && extra[id]) || {})))];
      await CDM.api.admin.guardarLista(nuevos.map((id) => filaLista(id, Object.fromEntries(claves.map((k) => [k, extra && extra[id] && extra[id][k] != null ? extra[id][k] : null])))));
      nuevos.forEach((id) => ctx.lista.push({ jugador_id: id, camiseta: extra && extra[id] && extra[id].camiseta != null ? extra[id].camiseta : null, posicion: (extra && extra[id] && extra[id].posicion) || null }));
    }
    return nuevos.length;
  }

  // Guarda un campo de una fila: apellido, nombre y apodo corrigen al jugador; puesto y camiseta, la lista del torneo.
  async function guardarCampo(tr, campo, valor) {
    const id = tr.dataset.id;
    const j = ctx.porId[id];
    try {
      if (campo === 'apellido' || campo === 'nombre' || campo === 'apodo') {
        const v = valor.trim();
        if (campo === 'apellido' && !v) { error('El apellido no puede quedar vacío.'); return; }
        if ((j[campo] || '') === v) return;
        await CDM.api.admin.editarJugador(id, { [campo]: v || null });
        j[campo] = v || null;
        const otrosAnios = (j.anios || []).filter((a) => a !== ctx.torneo.anio);
        estadoFila(tr, 'Guardado' + (otrosAnios.length ? '. Este jugador aparece también en ' + ui.unir(rangos(otrosAnios).split(', ')) : ''));
        pintarSoloAvisos(tr, j);
      } else {
        const extra = campo === 'puesto' ? { posicion: valor || null } : { camiseta: valor === '' ? null : parseInt(valor, 10) };
        await CDM.api.admin.guardarLista([filaLista(id, extra)]);
        const l = ctx.lista.find((x) => x.jugador_id === id);
        if (l) Object.assign(l, extra); else ctx.lista.push(Object.assign({ jugador_id: id, camiseta: null, posicion: null }, extra));
        estadoFila(tr, 'Guardado');
      }
      error('');
    } catch (err) {
      error(err.message);
    }
  }

  // Actualiza el aviso de revisar de una fila sin redibujar la tabla (para no perder el foco).
  function pintarSoloAvisos(tr, j) {
    const r = revisar(j);
    tr.classList.toggle('plantel-fila--revisar', !!r);
    const viejo = tr.querySelector('.plantel-aviso');
    if (viejo) viejo.remove();
    if (r) {
      const div = document.createElement('div');
      div.className = 'plantel-aviso';
      div.innerHTML = e(r.texto) + (r.par ? ' <a href="' + enlaceDuplicado(j.jugador_id, r.par) + '">Revisar</a>' : '');
      tr.querySelector('[data-campo="apellido"]').after(div);
    }
    const c = vistaActual.querySelector('#plantel-cuenta');
    if (c) c.textContent = cuenta();
  }

  // Sugerencias mientras se escribe el apellido en la fila nueva
  function sugerir(input) {
    const caja = input.parentElement.querySelector('.sugerencias');
    const t = norm(input.value);
    if (t.length < 2) { caja.hidden = true; return; }
    const ids = new Set(ctx.filas.map((f) => f.jugador_id));
    const lista = ctx.jugadores.filter((j) => norm(j.apellido).startsWith(t) || norm(j.apellido + ' ' + (j.nombre || '')).includes(t)).slice(0, 6);
    caja.innerHTML = lista.map((j) => '<button type="button" role="option" class="sugerencia" data-elegir="' + e(j.jugador_id) + '">' + e(nombre(j)) +
      ' <span class="texto-2">· ' + e(ctx.anios[j.jugador_id] || 'sin partidos') + (ids.has(j.jugador_id) ? ' · ya está' : '') + '</span></button>').join('') +
      '<button type="button" role="option" class="sugerencia sugerencia--nuevo" data-accion="crear-nuevo">+ Crear jugador nuevo "' + e(input.value.trim()) + '"</button>';
    caja.hidden = false;
  }

  async function crearDesdeFila(tr) {
    const ap = tr.querySelector('[data-nuevo="apellido"]').value.trim();
    if (!ap) return error('Escribí el apellido del jugador.');
    const no = tr.querySelector('[data-nuevo="nombre"]').value.trim();
    const apodo = tr.querySelector('[data-nuevo="apodo"]').value.trim();
    const puesto = tr.querySelector('[data-nuevo="puesto"]').value;
    try {
      const id = await CDM.api.admin.crearJugador(tituloCaso(ap), tituloCaso(no), ctx.categoria);
      const j = { jugador_id: id, apellido: tituloCaso(ap), nombre: tituloCaso(no) || null, apodo: apodo || null, anios: [] };
      if (apodo) await CDM.api.admin.editarJugador(id, { apodo });
      ctx.jugadores.push(j);
      ctx.porId[id] = j;
      ctx.nuevos.add(id);
      await sumar([id], { [id]: { posicion: puesto || null } });
      error('');
      pintarTabla();
      vistaActual.querySelector('[data-nuevo="apellido"]').focus();
    } catch (err) {
      error(err.message);
    }
  }

  async function elegirExistente(id) {
    try {
      if (ctx.filas.some((f) => f.jugador_id === id)) return error(nombre(ctx.porId[id]) + ' ya está en el plantel.');
      const puesto = vistaActual.querySelector('[data-nuevo="puesto"]').value;
      await sumar([id], { [id]: { posicion: puesto || null } });
      error('');
      pintarTabla();
      vistaActual.querySelector('[data-nuevo="apellido"]').focus();
    } catch (err) {
      error(err.message);
    }
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    const ir = (cambios) => CDM.router.cambiarFiltros('/admin/planteles', Object.assign({ anio: ctx.anio, torneo: ctx.letra, cat: ctx.cat }, cambios));

    vista.addEventListener('change', async (ev) => {
      const el = ev.target;
      if (el.dataset.filtro === 'anio') return ir({ anio: el.value, torneo: undefined });
      if (el.dataset.filtro === 'torneo') return ir({ torneo: el.value });
      if (el.id === 'pegar-archivo' && el.files[0]) {
        if (el.files[0].size > 200000) return error('El archivo es muy grande. Pegá la lista en el cuadro.');
        vista.querySelector('#pegar-texto').value = await el.files[0].text();
        previsualizar(vista.querySelector('#pegar-texto').value);
        vista.querySelector('#pegado').innerHTML = pegadoHtml();
        return;
      }
      if (el.dataset.pegado != null) { ctx.pegado[Number(el.dataset.pegado)].elegido = el.value; return; }
      const tr = el.closest('tr[data-id]');
      if (!tr) return;
      const campo = el.dataset.campo;
      if (campo === 'incluido' && !el.checked) {
        try {
          await CDM.api.admin.quitarDeLista(ctx.torneo.torneo_id, ctx.categoria, tr.dataset.id);
          ctx.lista = ctx.lista.filter((l) => l.jugador_id !== tr.dataset.id);
          pintarTabla();
        } catch (err) { el.checked = true; error(err.message); }
        return;
      }
      if (campo) guardarCampo(tr, campo, el.value);
    });

    vista.addEventListener('input', (ev) => {
      if (ev.target.dataset.nuevo === 'apellido') sugerir(ev.target);
    });

    // Enter pasa a la fila siguiente (en la fila nueva, agrega al jugador)
    vista.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
      const tr = ev.target.closest('tr');
      if (!tr || !tr.closest('#plantel-tabla')) return;
      ev.preventDefault();
      if (tr.dataset.nueva) {
        const primera = tr.querySelector('.sugerencia[data-elegir]');
        const ap = norm(tr.querySelector('[data-nuevo="apellido"]').value);
        const no = norm(tr.querySelector('[data-nuevo="nombre"]').value);
        // si el escrito coincide exacto con un jugador, se elige ese; si no, se crea
        const exacto = ctx.jugadores.find((j) => norm(j.apellido) === ap && norm(j.nombre) === no);
        if (exacto) return elegirExistente(exacto.jugador_id);
        if (ev.target.dataset.nuevo === 'apellido' && primera && !no) return ev.target.closest('tr').querySelector('[data-nuevo="nombre"]').focus();
        // si lo escrito es el comienzo de un solo jugador, se elige ese; si hay varios, se elige de la lista
        const ids = new Set(ctx.filas.map((f) => f.jugador_id));
        const empiezan = ctx.jugadores.filter((j) => !ids.has(j.jugador_id) && norm(j.apellido).startsWith(ap) && (!no || norm(j.nombre).startsWith(no)));
        if (empiezan.length === 1) return elegirExistente(empiezan[0].jugador_id);
        if (empiezan.length > 1 && primera) return primera.focus();
        return crearDesdeFila(tr);
      }
      ev.target.blur();
      const campo = ev.target.dataset.campo;
      const sig = tr.nextElementSibling && tr.nextElementSibling.querySelector('[data-campo="' + campo + '"], [data-nuevo="' + campo + '"]');
      if (sig) sig.focus();
    });

    vista.addEventListener('click', async (ev) => {
      const seg = ev.target.closest('[data-seg="cat"]');
      if (seg) return ir({ cat: seg.dataset.valor });
      const b = ev.target.closest('[data-accion], [data-quitar], [data-sumar], [data-elegir]');
      if (!b) return;
      if (b.dataset.elegir) return elegirExistente(b.dataset.elegir);
      if (b.dataset.quitar) {
        try {
          await CDM.api.admin.quitarDeLista(ctx.torneo.torneo_id, ctx.categoria, b.dataset.quitar);
          ctx.lista = ctx.lista.filter((l) => l.jugador_id !== b.dataset.quitar);
          pintarTabla();
        } catch (err) { error(err.message); }
        return;
      }
      if (b.dataset.sumar) {
        try { await sumar([b.dataset.sumar]); pintarTabla(); } catch (err) { error(err.message); }
        return;
      }
      switch (b.dataset.accion) {
        case 'agregar-fila': {
          const i = vista.querySelector('[data-nuevo="apellido"]');
          i.scrollIntoView({ block: 'center', behavior: 'smooth' });
          i.focus();
          return;
        }
        case 'crear-nuevo': return crearDesdeFila(b.closest('tr'));
        case 'sumar-marcados': {
          const ids = [...vista.querySelectorAll('[data-marcar]:checked')].map((c) => c.dataset.marcar);
          if (!ids.length) return error('Marcá los jugadores que querés sumar.');
          try { await sumar(ids); error(''); pintarTabla(); } catch (err) { error(err.message); }
          return;
        }
        case 'copiar': {
          const desde = vista.querySelector('#copiar-de').value;
          const t = ctx.torneos.find((x) => x.torneo_id === desde);
          b.disabled = true;
          try {
            const [est, lista] = await Promise.all([CDM.api.admin.plantelTorneo(desde, ctx.categoria), CDM.api.admin.listaPlantel(desde, ctx.categoria)]);
            const ids = [...new Set(est.map((x) => x.jugador_id).concat(lista.map((x) => x.jugador_id)))].filter((id) => !ctx.filas.some((f) => f.jugador_id === id));
            const extra = Object.fromEntries(lista.map((l) => [l.jugador_id, { posicion: l.posicion || null }]));
            const n = await sumar(ids, extra);
            CDM.admin.avisar('Copiado de ' + t.nombre + ': ' + ui.plural(n, 'jugador sumado', 'jugadores sumados') + '.');
            CDM.router.recargar();
          } catch (err) { b.disabled = false; error(err.message); }
          return;
        }
        case 'previsualizar': {
          const texto = vista.querySelector('#pegar-texto').value;
          if (!texto.trim()) return error('Pegá la lista o subí un archivo.');
          error('');
          previsualizar(texto);
          vista.querySelector('#pegado').innerHTML = pegadoHtml();
          return;
        }
        case 'sumar-pegado': {
          b.disabled = true;
          try {
            const extra = {};
            const ids = [];
            for (const l of ctx.pegado.filter((x) => !x.yaEsta)) {
              let id = l.elegido;
              if (id === '__nuevo') {
                id = await CDM.api.admin.crearJugador(l.apellido, l.nombre, ctx.categoria);
                const j = { jugador_id: id, apellido: l.apellido, nombre: l.nombre || null, anios: [] };
                ctx.jugadores.push(j);
                ctx.porId[id] = j;
                ctx.nuevos.add(id);
              }
              ids.push(id);
              extra[id] = { posicion: l.puesto || null, camiseta: l.camiseta };
            }
            // la fila de lista lleva camiseta solo si alguna línea la trae
            const conCamiseta = ids.some((id) => extra[id].camiseta != null);
            ids.forEach((id) => { if (!conCamiseta) delete extra[id].camiseta; });
            const n = await sumar([...new Set(ids)], extra);
            ctx.pegado = null;
            vista.querySelector('#pegar-texto').value = '';
            vista.querySelector('#pegado').innerHTML = '<p class="aviso aviso--ok">' + e(ui.plural(n, 'jugador sumado', 'jugadores sumados')) + ' al plantel.</p>';
            if (conCamiseta) ctx.hayCamisetas = true;
            pintarTabla();
          } catch (err) { b.disabled = false; error(err.message); }
          return;
        }
        default:
      }
    });

    // Cerrar las sugerencias al salir del campo
    vista.addEventListener('focusout', (ev) => {
      if (ev.target.dataset.nuevo !== 'apellido') return;
      setTimeout(() => {
        const caja = ev.target.parentElement && ev.target.parentElement.querySelector('.sugerencias');
        if (caja && !caja.contains(document.activeElement)) caja.hidden = true;
      }, 150);
    });
  }

  return { titulo: 'Planteles', seccion: 'admin', render, montar };
})();
