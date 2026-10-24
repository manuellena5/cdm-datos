// Cargar / editar partido (#/admin/partido/:id o #/admin/partido/nuevo) — mockup AdminCarga.
// Pensada para el celular: una sola pantalla con secciones. Guarda con una sola llamada (guardar_partido).
// Mientras se edita, el formulario se guarda en el navegador por si se cierra la página.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminPartido = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  const CATEGORIAS = ['Primera', 'Reserva'];
  const PLAYOFF = ['32avos', '16avos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
  const TIPOS_GOL = ['Jugada', 'Penal', 'Tiro libre', 'En contra'];
  const ESTADOS = ['Jugado', 'Programado', 'Suspendido', 'Postergado', 'Ganado por mesa', 'Sin dato'];
  const TIPOS_INC = ['Roja', 'Doble amarilla', 'Amarilla', 'Penal errado', 'Penal atajado', 'Expulsión del DT', 'Lesión', 'Partido suspendido', 'Otra'];
  const PREFIJO_FORM = 'cdm:form:';

  let ctx = null;   // datos de la pantalla y estado del formulario (ctx.s)
  let vistaActual = null;

  // ---------- Estado ----------
  const torneoDe = (id) => ctx.torneos.find((t) => t.torneo_id === id);
  const equipoDe = (id) => ctx.equipos.find((x) => x.equipo_id === id);
  const propio = () => ctx.equipos.find((x) => x.es_propio);
  const faseDe = (instancia) => (instancia && instancia.startsWith('F') ? 'Regular' : instancia);
  const fechaNroDe = (instancia) => (instancia && instancia.startsWith('F') ? Number(instancia.slice(1)) : null);
  const claveGrupo = (s) => [s.torneo_id, s.instancia, s.serie || ''].join('|');

  function filasDelGrupo(torneoId, instancia, serie) {
    const fase = faseDe(instancia);
    return ctx.partidos.filter((p) => p.torneo_id === torneoId && p.fase === fase &&
      (fase === 'Regular' ? p.fecha_nro === fechaNroDe(instancia) : (p.serie || '') === (serie || '')));
  }

  function ajustar(lista, n, vacio) {
    const copia = lista.slice(0, n);
    while (copia.length < n) copia.push(vacio());
    return copia;
  }
  const golVacio = () => ({ jugador_id: '', minuto: null, tipo: '', tiempo: null, nombre: '' });
  const ROLES = ['Titular', 'Suplente que entró', 'Convocado (suplente)', 'Suplente sin jugar'];
  const filaFormacion = (rol) => ({ jugador_id: '', rol, minuto_entra: null, minuto_sale: null, capitan: false, camiseta: null, amarilla: false });
  const rivalVacio = () => ({ nombre: '', minuto: null, tiempo: null, tipo: 'Sin dato' });

  async function cargarEstado(torneoId, instancia, serie) {
    const filas = filasDelGrupo(torneoId, instancia, serie);
    const base = filas.find((p) => p.categoria === 'Primera') || filas[0];
    const esPlayoff = faseDe(instancia) !== 'Regular';
    const s = {
      torneo_id: torneoId, instancia, serie: esPlayoff ? (serie || '') : '',
      rival_id: base ? base.rival_id : '', condicion: base ? base.condicion : 'L',
      fecha: base && base.fecha ? base.fecha : '', cancha: base && base.cancha ? base.cancha : '',
      observaciones: base && base.observaciones ? base.observaciones : '', fuente_url: '',
      existe: filas.length > 0, esBorrador: filas.some((p) => !p.publicado),
      fuentes: [...new Set(filas.flatMap((p) => p.fuente_ids || []))].length,
      cats: [], incidencias: [], nuevoJugador: null
    };
    const ids = filas.map((p) => p.partido_id);
    const [goles, incid, forms] = ids.length
      ? await Promise.all([CDM.api.admin.golesDe(ids), CDM.api.admin.incidenciasDe(ids), CDM.api.admin.formacionesDe(ids)])
      : [[], [], []];
    // Las amarillas de jugadores que están en la formación se marcan en su fila
    const amarillasEnFormacion = new Set();
    const formacionDe = (p) => forms.filter((f) => p && f.partido_id === p.partido_id)
      .sort((a, b) => (a.nro_lista || 99) - (b.nro_lista || 99))
      .map((f) => {
        const am = incid.find((i) => i.partido_id === f.partido_id && i.tipo === 'Amarilla' && i.lado === 'propio' && i.jugador_id === f.jugador_id);
        if (am) amarillasEnFormacion.add(am);
        return { jugador_id: f.jugador_id, rol: f.rol, minuto_entra: f.minuto_entra, minuto_sale: f.minuto_sale, capitan: !!f.capitan, camiseta: f.camiseta, amarilla: !!am };
      });
    CATEGORIAS.forEach((cat) => {
      const p = filas.find((x) => x.categoria === cat);
      const deCat = goles.filter((g) => p && g.partido_id === p.partido_id);
      const propios = deCat.filter((g) => g.lado === 'propio').map((g) => ({
        jugador_id: g.jugador_id || '', minuto: g.minuto, tiempo: g.tiempo, tipo: g.tipo === 'Sin dato' ? '' : g.tipo,
        nombre: g.jugador_id ? '' : (g.autor === 'Sin dato' ? '' : g.autor)
      }));
      const rivales = deCat.filter((g) => g.lado === 'rival').map((g) => ({
        nombre: g.autor === 'Sin dato' ? '' : g.autor, minuto: g.minuto, tiempo: g.tiempo, tipo: g.tipo
      }));
      s.cats.push({
        categoria: cat,
        incluida: p ? true : (!s.existe && !(esPlayoff && cat === 'Reserva')),
        partido_id: p ? p.partido_id : '',
        hora: p && p.hora ? ui.hora(p.hora) : '',
        arbitro: p && p.arbitro ? p.arbitro : '',
        estado: p ? p.estado : 'Programado',
        // sin marcador pero con resultado conocido (G/E/P): completitud "Inferido"
        inf: p && p.gf == null && p.resultado ? p.resultado : '',
        gf: p ? p.gf : null, gc: p ? p.gc : null,
        pf: p ? p.penales_favor : null, pc: p ? p.penales_contra : null,
        goles: p && p.gf != null ? ajustar(propios, Math.max(p.gf, propios.length), golVacio) : [],
        rivales: p && p.gc != null ? ajustar(rivales, Math.max(p.gc, rivales.length), rivalVacio) : [],
        formacion: formacionDe(p)
      });
    });
    s.incidencias = incid.filter((i) => !amarillasEnFormacion.has(i)).map((i) => ({
      categoria: (filas.find((p) => p.partido_id === i.partido_id) || {}).categoria || 'Primera',
      lado: i.lado, jugador_id: i.jugador_id || '', nombre: i.jugador_id ? '' : (i.quien || ''),
      tipo: i.tipo, minuto: i.minuto, descripcion: i.descripcion || ''
    }));
    ctx.s = s;
    ctx.recuperable = leerGuardado(s, filas);
    await cargarNombresRival();
  }

  async function cargarNombresRival() {
    const r = ctx.s.rival_id;
    if (!r || ctx.nombresRival[r]) return;
    try {
      const filas = await CDM.api.admin.nombresRival(r);
      ctx.nombresRival[r] = [...new Set(filas.map((f) => f.nombre_en_fuente))].sort((a, b) => a.localeCompare(b, 'es'));
    } catch (err) {
      ctx.nombresRival[r] = [];
    }
  }

  // ---------- Guardado local del formulario ----------
  function guardarLocal() {
    try { localStorage.setItem(PREFIJO_FORM + claveGrupo(ctx.s), JSON.stringify({ t: Date.now(), s: ctx.s })); } catch (err) { /* sin lugar */ }
  }
  function borrarLocal(s) {
    try { localStorage.removeItem(PREFIJO_FORM + claveGrupo(s)); } catch (err) { /* nada */ }
  }
  function leerGuardado(s, filas) {
    try {
      const g = JSON.parse(localStorage.getItem(PREFIJO_FORM + claveGrupo(s)) || 'null');
      if (!g) return null;
      const ultimo = filas.map((p) => Date.parse(p.actualizado_en) || 0).reduce((a, b) => Math.max(a, b), 0);
      return g.t > ultimo ? g.s : null;
    } catch (err) {
      return null;
    }
  }

  // ---------- HTML ----------
  const opcion = (valor, texto, actual) => '<option value="' + e(valor) + '"' + (String(valor) === String(actual ?? '') ? ' selected' : '') + '>' + e(texto) + '</option>';
  const nombreJugador = (j) => j.apellido + (j.nombre ? ', ' + j.nombre : '');

  function opcionesInstancia(s) {
    const deTorneo = ctx.partidos.filter((p) => p.torneo_id === s.torneo_id);
    const regulares = deTorneo.filter((p) => p.fase === 'Regular');
    const max = Math.max(0, ...regulares.map((p) => p.fecha_nro || 0),
      (torneoDe(s.torneo_id) || {}).fechas_regular || 0, fechaNroDe(s.instancia) || 0);
    let html = '';
    for (let n = 1; n <= max + 1; n++) {
      const p = regulares.find((x) => x.fecha_nro === n && x.categoria === 'Primera') || regulares.find((x) => x.fecha_nro === n);
      const extra = p ? ' · ' + p.rival : '';
      html += opcion('F' + n, 'Fecha ' + n + extra, s.instancia);
    }
    return html + PLAYOFF.map((f) => opcion(f, f, s.instancia)).join('') + opcion('Playoff', 'Playoff (instancia sin dato)', s.instancia);
  }

  function selectorJugador(k, cat, valor, deshabilitado) {
    const anio = (torneoDe(ctx.s.torneo_id) || {}).anio || 0;
    const recientes = new Set(ctx.recientes.filter((r) => r.categoria === cat && r.anio >= anio - 1).map((r) => r.jugador_id));
    const primero = ctx.jugadores.filter((j) => recientes.has(j.jugador_id) || j.division === cat);
    const resto = ctx.jugadores.filter((j) => !primero.includes(j));
    return '<select data-k="' + k + '" data-jugador="1"' + (deshabilitado ? ' disabled' : '') + '>' +
      opcion('', 'Elegí jugador…', valor) +
      '<optgroup label="' + e(cat + ' · recientes') + '">' + primero.map((j) => opcion(j.jugador_id, nombreJugador(j), valor)).join('') + '</optgroup>' +
      '<optgroup label="Otros">' + resto.map((j) => opcion(j.jugador_id, nombreJugador(j), valor)).join('') + '</optgroup>' +
      '<option value="__nuevo">+ Jugador nuevo…</option></select>';
  }

  function sinAcentos(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // Mini formulario de jugador nuevo, debajo del selector cuya ruta es `ruta` (goles o formación).
  function formNuevoJugador(ruta) {
    const n = ctx.s.nuevoJugador;
    if (!n || n.ruta !== ruta) return '';
    const parecidos = n.apellido.trim().length >= 3
      ? ctx.jugadores.filter((j) => sinAcentos(j.apellido).startsWith(sinAcentos(n.apellido))).slice(0, 5) : [];
    return '<div class="nuevo-jugador"><div class="fila-2">' +
      '<div class="campo"><label for="nj-ap">Apellido</label><input id="nj-ap" data-k="nuevoJugador.apellido" data-repinta="1" value="' + e(n.apellido) + '" autocomplete="off"></div>' +
      '<div class="campo"><label for="nj-no">Nombre</label><input id="nj-no" data-k="nuevoJugador.nombre" value="' + e(n.nombre) + '" autocomplete="off"></div></div>' +
      (parecidos.length ? '<p class="nota">Ya hay: ' + e(parecidos.map(nombreJugador).join(' · ')) + '. Si es el mismo, elegilo en la lista.</p>' : '') +
      '<div class="botones-chicos"><button type="button" class="boton" data-accion="crear-jugador">Crear jugador</button>' +
      '<button type="button" class="boton boton--borde" data-accion="cancelar-jugador">Cancelar</button></div></div>';
  }

  function marcador(ci, c, rivalNombre) {
    const caja = (lado, nombre, valor, clase) => '<div class="marcador-carga__caja">' +
      ui.escudo(lado === 'gf' ? propio() : equipoDe(ctx.s.rival_id), 28) +
      '<span class="marcador-carga__nombre ' + clase + '">' + e(nombre) + '</span><div class="marcador-carga__botones">' +
      '<button type="button" class="paso" data-accion="menos" data-cat="' + ci + '" data-lado="' + lado + '" aria-label="Restar gol a ' + e(nombre) + '">−</button>' +
      '<span class="marcador-carga__valor" aria-live="polite">' + (valor == null ? '–' : valor) + '</span>' +
      '<button type="button" class="paso paso--mas" data-accion="mas" data-cat="' + ci + '" data-lado="' + lado + '" aria-label="Sumar gol a ' + e(nombre) + '">+</button>' +
      '</div></div>';
    return '<div class="marcador-carga">' + caja('gf', propio().nombre_corto, c.gf, 'es-propio') + caja('gc', rivalNombre, c.gc, '') + '</div>' +
      (c.gf != null ? '<button type="button" class="enlace-boton" data-accion="sin-resultado" data-cat="' + ci + '">Sin resultado (queda programado)</button>' : '');
  }

  function seccionCategoria(ci, c, numero) {
    const s = ctx.s;
    const rival = equipoDe(s.rival_id);
    const rivalNombre = rival ? rival.nombre_corto : 'Rival';
    const esPlayoff = faseDe(s.instancia) !== 'Regular';
    const cabeza = '<div class="tarjeta__cabeza"><h2 class="tarjeta__titulo">' + numero + ' · ' + c.categoria + '</h2>' +
      '<label class="check"><input type="checkbox" data-accion="incluir" data-cat="' + ci + '"' + (c.incluida ? '' : ' checked') + '> No se jugó / no cargar</label></div>';
    if (!c.incluida) return '<section class="tarjeta carga">' + cabeza + '</section>';

    const golesPropios = c.goles.map((g, gi) => {
      const k = 'cats.' + ci + '.goles.' + gi;
      const enContra = g.tipo === 'En contra';
      return '<div class="gol-carga"><div class="gol-carga__fila"><div class="campo"><label>Gol ' + (gi + 1) + ' · Jugador</label>' +
        (enContra ? '<div class="gol-carga__contra">Gol en contra de ' + e(rivalNombre) + '</div>' : selectorJugador(k + '.jugador_id', c.categoria, g.jugador_id)) +
        (!enContra && !g.jugador_id && g.nombre ? '<span class="nota">La fuente dice: ' + e(g.nombre) + '</span>' : '') +
        '</div><div class="campo campo--min"><label>Min.</label><input type="number" inputmode="numeric" min="0" max="150" data-k="' + k + '.minuto" value="' + (g.minuto ?? '') + '" placeholder="–"></div></div>' +
        '<div class="pildoras" role="group" aria-label="Tipo de gol">' + TIPOS_GOL.map((t) =>
          '<button type="button" class="pildora" data-accion="tipo-gol" data-cat="' + ci + '" data-gol="' + gi + '" data-valor="' + t + '" aria-pressed="' + (g.tipo === t) + '">' + t + '</button>').join('') +
        '</div>' + formNuevoJugador(k + '.jugador_id') + '</div>';
    }).join('');

    const lista = 'sug-' + e(s.rival_id);
    const golesRival = c.rivales.map((g, gi) => {
      const k = 'cats.' + ci + '.rivales.' + gi;
      return '<div class="gol-carga gol-carga--rival"><div class="campo"><label>Gol ' + (gi + 1) + ' de ' + e(rivalNombre) + ' (opcional)</label>' +
        '<input data-k="' + k + '.nombre" list="' + lista + '" value="' + e(g.nombre) + '" placeholder="Nombre" autocomplete="off"></div>' +
        '<div class="campo campo--min"><label>Min.</label><input type="number" inputmode="numeric" min="0" max="150" data-k="' + k + '.minuto" value="' + (g.minuto ?? '') + '" placeholder="–"></div></div>';
    }).join('');

    const faltan = c.goles.filter((g) => !g.jugador_id && g.tipo !== 'En contra').length;
    const penales = esPlayoff && c.gf != null && c.gf === c.gc
      ? '<div class="fila-2"><div class="campo"><label>Penales ' + e(propio().nombre_corto) + '</label><input type="number" inputmode="numeric" min="0" data-k="cats.' + ci + '.pf" value="' + (c.pf ?? '') + '"></div>' +
        '<div class="campo"><label>Penales ' + e(rivalNombre) + '</label><input type="number" inputmode="numeric" min="0" data-k="cats.' + ci + '.pc" value="' + (c.pc ?? '') + '"></div></div>'
      : '';

    return '<section class="tarjeta carga" aria-label="' + c.categoria + '">' + cabeza + marcador(ci, c, rivalNombre) + penales +
      (c.goles.length ? '<div class="carga__grupo"><span class="campo__etiqueta">Goles de ' + e(propio().nombre_corto) + ' (' + c.goles.length + ')</span>' + golesPropios +
        (faltan ? '<p class="aviso-suave">' + (faltan === 1 ? 'Falta elegir 1 goleador.' : 'Faltan elegir ' + faltan + ' goleadores.') + ' Se puede guardar igual.</p>' : '') + '</div>' : '') +
      (c.rivales.length ? '<div class="carga__grupo">' + golesRival + '</div>' : '') +
      seccionFormacion(ci, c) +
      '<div class="fila-2"><div class="campo"><label for="est-' + ci + '">Estado</label><select id="est-' + ci + '" data-k="cats.' + ci + '.estado" data-repinta="1">' +
      ESTADOS.map((x) => opcion(x, x, c.estado)).join('') + '</select></div>' +
      (c.gf == null && c.estado !== 'Programado'
        ? '<div class="campo"><label for="inf-' + ci + '">Resultado sin marcador</label><select id="inf-' + ci + '" data-k="cats.' + ci + '.inf">' +
          opcion('', 'No se sabe', c.inf) + opcion('G', 'Ganó', c.inf) + opcion('E', 'Empató', c.inf) + opcion('P', 'Perdió', c.inf) + '</select></div>'
        : '') + '</div>' +
      '<div class="fila-2"><div class="campo"><label for="hora-' + ci + '">Hora</label><input id="hora-' + ci + '" type="time" data-k="cats.' + ci + '.hora" value="' + e(c.hora) + '"></div>' +
      '<div class="campo"><label for="arb-' + ci + '">Árbitro</label><input id="arb-' + ci + '" data-k="cats.' + ci + '.arbitro" value="' + e(c.arbitro) + '" autocomplete="off"></div></div>' +
      '</section>';
  }

  // Último partido de la categoría con formación cargada, anterior a este (para copiar la formación).
  function anteriorConFormacion(c) {
    const s = ctx.s;
    const clave = (p) => String(p.fecha || '') + String(p.torneo_orden).padStart(6, '0') + String(p.fecha_nro || 0).padStart(3, '0');
    return ctx.partidos
      .filter((p) => p.categoria === c.categoria && p.partido_id !== c.partido_id && ctx.conFormacion.has(p.partido_id) &&
        (!s.fecha || !p.fecha || p.fecha < s.fecha))
      .sort((a, b) => clave(b).localeCompare(clave(a)))[0];
  }

  function seccionFormacion(ci, c) {
    const titulares = c.formacion.filter((f) => f.rol === 'Titular').length;
    const repetidos = c.formacion.filter((f, i) => f.jugador_id && c.formacion.findIndex((x) => x.jugador_id === f.jugador_id) !== i).length;
    const anterior = !c.formacion.length && anteriorConFormacion(c);
    const filas = c.formacion.map((f, fi) => {
      const k = 'cats.' + ci + '.formacion.' + fi;
      const min = (campo, etiqueta) => '<div class="campo campo--min"><label>' + etiqueta + '</label><input type="number" inputmode="numeric" min="0" max="150" data-k="' +
        k + '.' + campo + '" value="' + (f[campo] ?? '') + '" placeholder="–"></div>';
      return '<div class="form-fila"><div class="form-fila__arriba"><span class="form-fila__nro">' + (fi + 1) + '</span>' +
        '<div class="campo form-fila__jugador"><label class="oculto">Jugador ' + (fi + 1) + '</label>' + selectorJugador(k + '.jugador_id', c.categoria, f.jugador_id) + '</div></div>' +
        '<div class="form-fila__abajo"><div class="campo"><label>Rol</label><select data-k="' + k + '.rol" data-repinta="1">' +
        ROLES.map((r) => opcion(r, r === 'Convocado (suplente)' ? 'Convocado (no se sabe si entró)' : r, f.rol)).join('') + '</select></div>' +
        (f.rol === 'Suplente que entró' ? min('minuto_entra', 'Entró') : '') +
        (f.rol === 'Titular' || f.rol === 'Suplente que entró' ? min('minuto_sale', 'Salió') : '') +
        '<label class="check"><input type="checkbox" data-k="' + k + '.capitan" data-capitan="' + ci + '"' + (f.capitan ? ' checked' : '') + '> Capitán</label>' +
        '<label class="check"><input type="checkbox" data-k="' + k + '.amarilla"' + (f.amarilla ? ' checked' : '') + '> Amarilla</label>' +
        '<button type="button" class="enlace-boton" data-accion="quitar-jugador" data-cat="' + ci + '" data-fila="' + fi + '">Quitar</button></div>' +
        formNuevoJugador(k + '.jugador_id') + '</div>';
    }).join('');
    return '<details class="formacion-carga"' + (c.formacion.length ? ' open' : '') + '><summary>Formación (opcional)' +
      (c.formacion.length ? ' · ' + ui.plural(titulares, 'titular', 'titulares') + ', ' + (c.formacion.length - titulares) + ' más' : '') + '</summary>' +
      '<div class="formacion-carga__cuerpo">' +
      (!c.formacion.length && c.categoria === 'Primera' && /formaci[oó]n\s*:/i.test(ctx.s.observaciones || '')
        ? '<p class="aviso-suave">Las observaciones tienen la formación escrita. Pasala acá con "+ Titular" para que cuente en el plantel.</p>' : '') +
      filas +
      (repetidos ? '<p class="aviso-suave">Hay un jugador repetido en la formación. Corregilo antes de guardar.</p>' : '') +
      (titulares > 11 ? '<p class="aviso-suave">Hay más de 11 titulares.</p>' : '') +
      '<div class="botones-chicos">' +
      '<button type="button" class="boton boton--borde" data-accion="agregar-jugador" data-cat="' + ci + '" data-rol="' + (titulares < 11 ? 'Titular' : 'Suplente que entró') + '">+ ' +
      (titulares < 11 ? 'Titular' : 'Suplente') + '</button>' +
      (titulares < 11 && c.formacion.length ? '' : '<button type="button" class="boton boton--borde" data-accion="agregar-jugador" data-cat="' + ci + '" data-rol="Convocado (suplente)">+ Convocado</button>') +
      (anterior ? '<button type="button" class="boton boton--borde" data-accion="copiar-formacion" data-cat="' + ci + '" data-desde="' + e(anterior.partido_id) + '">Copiar de ' +
        e(ui.instancia(anterior) + ' vs ' + anterior.rival) + '</button>' : '') +
      '</div></div></details>';
  }

  function seccionIncidencias(numero) {
    const s = ctx.s;
    const incluidas = s.cats.filter((c) => c.incluida).map((c) => c.categoria);
    const rival = equipoDe(s.rival_id);
    const filas = s.incidencias.map((i, ii) => {
      const k = 'incidencias.' + ii;
      return '<div class="incidencia-carga">' +
        '<div class="fila-2">' +
        (incluidas.length > 1 ? '<div class="campo"><label>Categoría</label><select data-k="' + k + '.categoria">' + incluidas.map((c) => opcion(c, c, i.categoria)).join('') + '</select></div>' : '') +
        '<div class="campo"><label>Tipo</label><select data-k="' + k + '.tipo">' + TIPOS_INC.map((t) => opcion(t, t, i.tipo)).join('') + '</select></div>' +
        '<div class="campo"><label>Equipo</label><select data-k="' + k + '.lado" data-repinta="1">' +
        opcion('propio', propio().nombre_corto, i.lado) + opcion('rival', rival ? rival.nombre_corto : 'Rival', i.lado) + opcion('partido', 'El partido', i.lado) + '</select></div>' +
        '<div class="campo campo--min"><label>Min.</label><input type="number" inputmode="numeric" min="0" max="150" data-k="' + k + '.minuto" value="' + (i.minuto ?? '') + '" placeholder="–"></div>' +
        '</div>' +
        (i.lado === 'propio' ? '<div class="campo"><label>Jugador</label>' + selectorJugador(k + '.jugador_id', i.categoria, i.jugador_id).replace(/<option value="__nuevo">[^<]*<\/option>/, '') + '</div>'
          : i.lado === 'rival' ? '<div class="campo"><label>Jugador (opcional)</label><input data-k="' + k + '.nombre" value="' + e(i.nombre) + '" autocomplete="off"></div>' : '') +
        '<div class="campo"><label>Comentario (opcional)</label><input data-k="' + k + '.descripcion" value="' + e(i.descripcion) + '" autocomplete="off"></div>' +
        '<button type="button" class="enlace-boton" data-accion="quitar-incidencia" data-inc="' + ii + '">Quitar incidencia</button></div>';
    }).join('');
    return '<section class="tarjeta carga" aria-label="Incidencias"><h2 class="tarjeta__titulo">' + numero + ' · Incidencias (opcional)</h2>' + filas +
      (incluidas.length ? '<button type="button" class="boton boton--borde" data-accion="agregar-incidencia">+ Agregar incidencia</button>' : '') + '</section>';
  }

  function formulario() {
    const s = ctx.s;
    const esPlayoff = faseDe(s.instancia) !== 'Regular';
    const hayResultado = s.cats.some((c) => c.incluida && (c.gf != null || (c.estado && c.estado !== 'Programado')));
    const sugerencias = '<datalist id="sug-' + e(s.rival_id) + '">' + (ctx.nombresRival[s.rival_id] || []).map((n) => '<option value="' + e(n) + '">').join('') + '</datalist>';
    let numero = 2;
    const cats = s.cats.map((c, ci) => seccionCategoria(ci, c, numero++)).join('');
    return (ctx.prueba ? '<div class="aviso">Modo prueba: lo que guardes queda marcado como prueba en el registro de cambios.</div>' : '') +
      (ctx.recuperable ? '<div class="aviso">Hay cambios sin guardar de antes en este partido. ' +
        '<button type="button" class="enlace-boton" data-accion="recuperar">Recuperarlos</button> · ' +
        '<button type="button" class="enlace-boton" data-accion="descartar">Descartar</button></div>' : '') +
      '<section class="tarjeta carga" aria-label="Datos del partido"><h2 class="tarjeta__titulo">1 · Partido</h2>' +
      '<div class="fila-2"><div class="campo"><label for="c-torneo">Torneo</label><select id="c-torneo" data-k="torneo_id" data-estructura="1">' +
      ctx.torneos.map((t) => opcion(t.torneo_id, t.nombre, s.torneo_id)).join('') + '</select></div>' +
      '<div class="campo"><label for="c-inst">Fecha / instancia</label><select id="c-inst" data-k="instancia" data-estructura="1">' + opcionesInstancia(s) + '</select></div></div>' +
      (esPlayoff ? '<div class="campo"><label for="c-serie">Serie</label><select id="c-serie" data-k="serie" data-estructura="1">' +
        opcion('', 'Partido único', s.serie) + opcion('Ida', 'Ida', s.serie) + opcion('Vuelta', 'Vuelta', s.serie) + '</select></div>' : '') +
      '<div class="campo"><label for="c-rival">Rival</label><div class="selector-escudo">' + ui.escudo(equipoDe(s.rival_id), 36) +
      '<select id="c-rival" data-k="rival_id" data-repinta="1" data-cancha="1">' + opcion('', 'Elegí rival…', s.rival_id) +
      ctx.equipos.filter((x) => !x.es_propio).map((x) => opcion(x.equipo_id, x.nombre_corto, s.rival_id)).join('') + '</select></div></div>' +
      ui.segmentado('condicion', propio().nombre_corto + ' juega de', [{ valor: 'L', texto: 'Local' }, { valor: 'V', texto: 'Visitante' }], s.condicion) +
      '<div class="fila-2"><div class="campo"><label for="c-dia">Día</label><input id="c-dia" type="date" data-k="fecha" value="' + e(s.fecha) + '"></div>' +
      '<div class="campo"><label for="c-cancha">Cancha</label><input id="c-cancha" data-k="cancha" value="' + e(s.cancha) + '" autocomplete="off"></div></div>' +
      (s.existe ? '<p class="nota">Rival, condición y cancha salen del fixture. Se pueden corregir.</p>' : '') + '</section>' +
      cats + seccionIncidencias(numero++) +
      '<section class="tarjeta carga" aria-label="Extras"><h2 class="tarjeta__titulo">' + numero + ' · Extras (opcional)</h2>' +
      '<div class="campo"><label for="c-fuente">Link de la fuente</label><input id="c-fuente" type="url" data-k="fuente_url" value="' + e(s.fuente_url) + '" placeholder="Posteo del club, crónica…" autocomplete="off"></div>' +
      (s.fuentes ? '<p class="nota">Ya tiene ' + ui.plural(s.fuentes, 'fuente cargada', 'fuentes cargadas') + '.</p>' : '') +
      '<div class="campo"><label for="c-obs">Observaciones</label><textarea id="c-obs" rows="2" data-k="observaciones">' + e(s.observaciones) + '</textarea></div></section>' +
      sugerencias +
      '<p class="form-error" role="alert" hidden></p>' +
      '<div class="botones-carga">' +
      (hayResultado
        ? '<button type="button" class="boton boton--borde boton--grande" data-accion="guardar" data-publicar="0">Guardar borrador</button>' +
          '<button type="button" class="boton boton--grande" data-accion="guardar" data-publicar="1">Publicar</button>'
        : '<button type="button" class="boton boton--grande boton--ancho" data-accion="guardar" data-publicar="1">Guardar programación</button>') +
      '</div>' +
      (s.esBorrador ? '<button type="button" class="enlace-boton enlace-boton--peligro" data-accion="borrar">Eliminar borrador</button>' : '');
  }

  function pintar() {
    const cont = vistaActual && vistaActual.querySelector('#carga');
    if (cont) cont.innerHTML = formulario();
  }

  // ---------- Cambios del formulario ----------
  function asignar(ruta, valor) {
    const partes = ruta.split('.');
    let obj = ctx.s;
    partes.slice(0, -1).forEach((p) => { obj = obj[/^\d+$/.test(p) ? Number(p) : p]; });
    const ultimo = partes[partes.length - 1];
    if (['minuto', 'pf', 'pc', 'minuto_entra', 'minuto_sale', 'camiseta'].includes(ultimo)) {
      valor = valor === '' ? null : Math.max(0, parseInt(valor, 10) || 0);
    }
    obj[ultimo] = valor;
  }

  function canchaAutomatica() {
    const s = ctx.s;
    const dueno = s.condicion === 'L' ? propio() : equipoDe(s.rival_id);
    return dueno && dueno.cancha ? dueno.cancha : '';
  }

  async function cambiarGrupo() {
    const s = ctx.s;
    // Si se elige otra fecha/instancia, se cargan los datos que ya tenga
    await cargarEstado(s.torneo_id, s.instancia, s.serie);
    pintar();
  }

  function sumar(ci, lado, delta) {
    const c = ctx.s.cats[ci];
    if (c.gf == null) {
      c.gf = 0;
      c.gc = 0;
      c.inf = '';
      if (!c.estado || c.estado === 'Programado' || c.estado === 'Sin dato') c.estado = 'Jugado';
    }
    c[lado] = Math.max(0, Math.min(30, c[lado] + delta));
    c.goles = ajustar(c.goles, c.gf, golVacio);
    c.rivales = ajustar(c.rivales, c.gc, rivalVacio);
    if (!(c.gf === c.gc)) { c.pf = null; c.pc = null; }
  }

  function payload(publicar) {
    const s = ctx.s;
    const fase = faseDe(s.instancia);
    const cats = s.cats.filter((c) => c.incluida);
    return {
      torneo_id: s.torneo_id, fase, fecha_nro: fechaNroDe(s.instancia), serie: fase === 'Regular' ? null : (s.serie || null),
      rival_id: s.rival_id, condicion: s.condicion, fecha: s.fecha || null, cancha: s.cancha.trim() || null,
      fuente_url: s.fuente_url.trim() || null, observaciones: s.observaciones.trim() || null,
      publicado: publicar, prueba: !!ctx.prueba,
      categorias: cats.map((c) => ({
        categoria: c.categoria, partido_id: c.partido_id || null, hora: c.hora || null, arbitro: c.arbitro.trim() || null,
        estado: c.estado || null, resultado_informado: c.gf == null ? (c.inf || null) : null,
        gf: c.gf, gc: c.gc,
        penales_favor: c.gf != null && c.gf === c.gc ? c.pf : null, penales_contra: c.gf != null && c.gf === c.gc ? c.pc : null,
        goles: c.goles.map((g) => ({ lado: 'propio', jugador_id: g.jugador_id || null, nombre: g.nombre || null, minuto: g.minuto, tiempo: g.tiempo, tipo: g.tipo || 'Sin dato' }))
          .concat(c.rivales.map((g) => ({ lado: 'rival', nombre: g.nombre.trim() || null, minuto: g.minuto, tiempo: g.tiempo, tipo: g.tipo || 'Sin dato' }))),
        incidencias: s.incidencias.filter((i) => i.categoria === c.categoria).map((i) => ({
          lado: i.lado, jugador_id: i.jugador_id || null, nombre: i.nombre.trim() || null, tipo: i.tipo, minuto: i.minuto,
          descripcion: i.descripcion.trim() || null
        })).concat(c.formacion.filter((f) => f.jugador_id && f.amarilla).map((f) => ({
          lado: 'propio', jugador_id: f.jugador_id, nombre: null, tipo: 'Amarilla', minuto: null, descripcion: null
        }))),
        formacion: c.formacion.filter((f) => f.jugador_id).map((f, i) => ({
          jugador_id: f.jugador_id, rol: f.rol, nro_lista: i + 1, camiseta: f.camiseta,
          minuto_entra: f.rol === 'Suplente que entró' ? f.minuto_entra : null,
          minuto_sale: f.rol === 'Titular' || f.rol === 'Suplente que entró' ? f.minuto_sale : null,
          capitan: !!f.capitan
        }))
      }))
    };
  }

  function mostrarError(texto) {
    const p = vistaActual.querySelector('.form-error');
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function descripcion() {
    const s = ctx.s;
    const rival = equipoDe(s.rival_id);
    const inst = faseDe(s.instancia) === 'Regular' ? s.instancia : s.instancia + (s.serie ? ' (' + s.serie.toLowerCase() + ')' : '');
    return inst + ' vs ' + (rival ? rival.nombre_corto : '');
  }

  async function guardar(publicar, boton) {
    const s = ctx.s;
    if (!s.rival_id) return mostrarError('Elegí el rival.');
    if (!s.cats.some((c) => c.incluida)) return mostrarError('Cargá al menos una categoría.');
    const repetida = s.cats.find((c) => c.incluida && c.formacion.some((f, i) => f.jugador_id && c.formacion.findIndex((x) => x.jugador_id === f.jugador_id) !== i));
    if (repetida) return mostrarError('En la formación de ' + repetida.categoria + ' hay un jugador repetido.');
    const hayResultado = s.cats.some((c) => c.incluida && (c.gf != null || (c.estado && c.estado !== 'Programado')));
    mostrarError('');
    const botones = vistaActual.querySelectorAll('[data-accion="guardar"]');
    botones.forEach((b) => { b.disabled = true; });
    const textoBoton = boton.textContent;
    boton.textContent = 'Guardando…';
    try {
      await CDM.api.admin.guardarPartido(payload(publicar));
      borrarLocal(s);
      CDM.admin.avisar((!hayResultado ? 'Programación guardada' : publicar ? 'Publicado' : 'Borrador guardado') + ': ' + descripcion() + '.');
      location.hash = '#/admin';
    } catch (err) {
      mostrarError(err.message);
      botones.forEach((b) => { b.disabled = false; });
      boton.textContent = textoBoton;
    }
  }

  async function borrar() {
    if (!window.confirm('¿Eliminar este borrador? No se puede deshacer.')) return;
    const ids = ctx.s.cats.map((c) => c.partido_id).filter(Boolean);
    try {
      const n = await CDM.api.admin.borrarBorrador(ids, ctx.prueba);
      if (!n) return mostrarError('Este partido no se puede eliminar porque estuvo publicado. Podés editarlo.');
      borrarLocal(ctx.s);
      CDM.admin.avisar('Borrador eliminado: ' + descripcion() + '.');
      location.hash = '#/admin';
    } catch (err) {
      mostrarError(err.message);
    }
  }

  async function crearJugador() {
    const n = ctx.s.nuevoJugador;
    if (!n.apellido.trim()) return mostrarError('Escribí el apellido del jugador nuevo.');
    const cat = ctx.s.cats[Number(n.ruta.split('.')[1])].categoria;
    try {
      const id = await CDM.api.admin.crearJugador(n.apellido.trim(), n.nombre.trim(), cat);
      ctx.jugadores.push({ jugador_id: id, apellido: n.apellido.trim(), nombre: n.nombre.trim() || null, division: cat });
      ctx.jugadores.sort((a, b) => nombreJugador(a).localeCompare(nombreJugador(b), 'es'));
      asignar(n.ruta, id);
      ctx.s.nuevoJugador = null;
      mostrarError('');
      pintar();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  async function alHacerClick(ev) {
    const b = ev.target.closest('[data-accion], [data-seg]');
    if (!b || b.tagName === 'INPUT') return;
    const s = ctx.s;
    const ci = Number(b.dataset.cat);
    switch (b.dataset.accion) {
      case 'mas': sumar(ci, b.dataset.lado, 1); break;
      case 'menos': sumar(ci, b.dataset.lado, -1); break;
      case 'sin-resultado':
        Object.assign(s.cats[ci], { gf: null, gc: null, pf: null, pc: null, goles: [], rivales: [], estado: 'Programado', inf: '' });
        break;
      case 'tipo-gol': {
        const g = s.cats[ci].goles[Number(b.dataset.gol)];
        g.tipo = g.tipo === b.dataset.valor ? '' : b.dataset.valor;
        if (g.tipo === 'En contra') g.jugador_id = '';
        break;
      }
      case 'agregar-incidencia': {
        const cat = s.cats.find((c) => c.incluida).categoria;
        s.incidencias.push({ categoria: cat, lado: 'propio', jugador_id: '', nombre: '', tipo: 'Roja', minuto: null, descripcion: '' });
        break;
      }
      case 'quitar-incidencia': s.incidencias.splice(Number(b.dataset.inc), 1); break;
      case 'agregar-jugador': s.cats[ci].formacion.push(filaFormacion(b.dataset.rol)); break;
      case 'quitar-jugador': s.cats[ci].formacion.splice(Number(b.dataset.fila), 1); break;
      case 'copiar-formacion': {
        try {
          const filas = await CDM.api.admin.formacionesDe([b.dataset.desde]);
          s.cats[ci].formacion = filas.sort((x, y) => (x.nro_lista || 99) - (y.nro_lista || 99))
            .map((f) => Object.assign(filaFormacion(f.rol), { jugador_id: f.jugador_id, capitan: !!f.capitan, camiseta: f.camiseta }));
        } catch (err) {
          return mostrarError(err.message || 'No se pudo copiar la formación.');
        }
        break;
      }
      case 'cancelar-jugador': s.nuevoJugador = null; break;
      case 'crear-jugador': return crearJugador();
      case 'guardar': return guardar(b.dataset.publicar === '1', b);
      case 'borrar': return borrar();
      case 'recuperar':
        ctx.s = ctx.recuperable;
        ctx.s.cats.forEach((c) => { c.formacion = c.formacion || []; });   // guardado con una versión anterior
        ctx.recuperable = null;
        await cargarNombresRival();
        break;
      case 'descartar': borrarLocal(s); ctx.recuperable = null; break;
      default: {
        if (b.dataset.seg === 'condicion') {
          const antes = canchaAutomatica();
          s.condicion = b.dataset.valor;
          if (!s.cancha || s.cancha === antes) s.cancha = canchaAutomatica();
          break;
        }
        return;
      }
    }
    guardarLocal();
    pintar();
  }

  async function alCambiar(ev) {
    const el = ev.target;
    if (el.dataset.accion === 'incluir') {
      const c = ctx.s.cats[Number(el.dataset.cat)];
      c.incluida = !el.checked;
      if (!c.incluida) ctx.s.incidencias = ctx.s.incidencias.filter((i) => i.categoria !== c.categoria);
      guardarLocal();
      return pintar();
    }
    const k = el.dataset.k;
    if (!k) return;
    if (el.dataset.jugador && el.value === '__nuevo') {
      ctx.s.nuevoJugador = { ruta: k, apellido: '', nombre: '' };
      el.value = '';
      pintar();
      const ap = vistaActual.querySelector('#nj-ap');
      if (ap) ap.focus();
      return;
    }
    const antesCancha = el.dataset.cancha ? canchaAutomatica() : null;
    asignar(k, el.type === 'checkbox' ? el.checked : el.value);
    // Un solo capitán por categoría
    if (el.dataset.capitan && el.checked) {
      ctx.s.cats[Number(el.dataset.capitan)].formacion.forEach((f, i) => { if ('cats.' + el.dataset.capitan + '.formacion.' + i + '.capitan' !== k) f.capitan = false; });
      guardarLocal();
      return pintar();
    }
    if (el.dataset.cancha && (!ctx.s.cancha || ctx.s.cancha === antesCancha)) ctx.s.cancha = canchaAutomatica();
    guardarLocal();
    if (el.dataset.estructura && ev.type === 'change') {
      if (k === 'torneo_id') {
        // Al cambiar de torneo, ir a la primera fecha sin resultado
        const prog = ctx.partidos.filter((p) => p.torneo_id === ctx.s.torneo_id && p.fase === 'Regular')
          .sort((a, b) => a.fecha_nro - b.fecha_nro);
        const pend = prog.find((p) => p.estado === 'Programado');
        ctx.s.instancia = 'F' + (pend ? pend.fecha_nro : Math.max(0, ...prog.map((p) => p.fecha_nro || 0)) + 1);
        ctx.s.serie = '';
      }
      return cambiarGrupo();
    }
    if (el.dataset.repinta && ev.type === 'change') {
      if (k === 'rival_id') await cargarNombresRival();
      pintar();
    }
  }

  // ---------- Pantalla ----------
  async function render(params, query) {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const api = CDM.api.admin;
    const [partidos, equipos, torneos, jugadores, recientes, conFormacion] = await Promise.all([
      api.partidos(), api.equipos(), api.torneos(), api.jugadores(), api.goleadoresRecientes(), api.partidosConFormacion()
    ]);
    ctx = { admin: acceso.admin, partidos, equipos, torneos, jugadores, recientes, conFormacion: new Set(conFormacion),
      nombresRival: {}, prueba: query.get('prueba') === '1' };

    let torneoId, instancia, serie = '';
    const p = params.id !== 'nuevo' && partidos.find((x) => x.partido_id === params.id);
    if (p) {
      torneoId = p.torneo_id;
      instancia = p.fase === 'Regular' ? 'F' + p.fecha_nro : p.fase;
      serie = p.serie || '';
    } else {
      torneoId = torneos.some((t) => t.torneo_id === query.get('torneo')) ? query.get('torneo') : torneos[0].torneo_id;
      const regulares = partidos.filter((x) => x.torneo_id === torneoId && x.fase === 'Regular');
      const pend = regulares.filter((x) => x.estado === 'Programado').sort((a, b) => a.fecha_nro - b.fecha_nro)[0];
      // Desde "Pendientes de carga" llega la fecha que falta (?instancia=F3)
      instancia = /^F\d+$/.test(query.get('instancia') || '') ? query.get('instancia')
        : 'F' + (pend ? pend.fecha_nro : Math.max(0, ...regulares.map((x) => x.fecha_nro || 0)) + 1);
    }
    await cargarEstado(torneoId, instancia, serie);
    // Desde "Pendientes de carga": sumar la categoría que falta en un partido que ya existe (?incluir=Reserva)
    const incluir = ctx.s.cats.find((c) => c.categoria === query.get('incluir'));
    if (incluir) incluir.incluida = true;
    const titulo = ctx.s.existe && ctx.s.cats.some((c) => c.gf != null) ? 'Editar partido' : 'Cargar partido';
    return CDM.admin.barra(titulo, acceso.admin, { volver: '#/admin' }) + '<form id="carga" class="carga-form" novalidate>' + formulario() + '</form>';
  }

  function montar(vista) {
    vistaActual = vista;
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    vista.addEventListener('click', alHacerClick);
    vista.addEventListener('change', alCambiar);
    vista.addEventListener('input', (ev) => {
      const el = ev.target;
      if (!el.dataset.k || el.tagName === 'SELECT' || el.type === 'checkbox') return;
      asignar(el.dataset.k, el.value);
      guardarLocal();
      // Las sugerencias de jugadores parecidos se actualizan mientras se escribe el apellido
      if (el.id === 'nj-ap') {
        const pos = el.selectionStart;
        pintar();
        const nuevo = vistaActual.querySelector('#nj-ap');
        if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
      }
    });
    vista.addEventListener('submit', (ev) => ev.preventDefault());
  }

  return { titulo: 'Cargar partido', seccion: 'admin', render, montar };
})();
