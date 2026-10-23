// Administración (#/admin): ingreso (mockup AdminIngreso) y panel de carga (mockup AdminPanel).
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

// Piezas que comparten el panel y la pantalla de carga.
CDM.admin = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;

  // Devuelve { admin } si hay sesión de administrador; si no, { html } con lo que hay que mostrar.
  async function verificarAcceso() {
    if (!CDM.api.configurada) return { html: ui.errorCarga(new Error('sin-configurar')) };
    let sesion;
    try {
      sesion = await CDM.api.sesion();
    } catch (err) {
      sesion = null;
    }
    if (!sesion) return { html: ingreso() };
    let admin;
    try {
      admin = await CDM.api.administrador();
    } catch (err) {
      throw new Error('sin-conexion');
    }
    if (!admin) {
      return {
        html: '<section class="tarjeta vacio"><h2 class="vacio__titulo">Sin permiso</h2>' +
          '<p>Tu usuario no tiene permiso para cargar datos.</p>' +
          '<p><button type="button" class="boton" data-accion="salir">Salir</button></p></section>'
      };
    }
    return { admin };
  }

  function ingreso() {
    return '<section class="ingreso" aria-label="Ingreso de administrador">' +
      '<div class="ingreso__marca"><img src="assets/escudo.png" alt="" width="72" height="72">' +
      '<h1>MODO ADMINISTRADOR</h1><p>Para cargar y corregir partidos.<br>Mirar el historial no necesita clave.</p></div>' +
      '<form class="ingreso__form" data-form="ingreso" novalidate>' +
      '<div class="campo"><label for="a-user">Usuario</label>' +
      '<input id="a-user" name="email" type="email" autocomplete="username" placeholder="tu correo" required></div>' +
      '<div class="campo"><label for="a-pass">Clave</label><div class="clave">' +
      '<input id="a-pass" name="clave" type="password" autocomplete="current-password" required>' +
      '<button type="button" class="boton-icono" data-accion="ver-clave" aria-label="Mostrar clave" aria-pressed="false">' +
      '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '</button></div></div>' +
      '<p class="form-error" role="alert" hidden></p>' +
      '<button type="submit" class="boton boton--grande">Ingresar</button>' +
      '<p class="nota centro">Cada cambio queda registrado con tu nombre.</p></form>' +
      '<a class="ingreso__volver" href="#/resultados">Volver al historial</a></section>';
  }

  function barra(titulo, admin, volver) {
    return '<header class="barra-admin">' +
      (volver ? '<a href="' + volver + '" class="barra-admin__volver" aria-label="Volver al panel">' +
        '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></a>' : '') +
      '<div class="barra-admin__titulo"><h1>' + e(titulo) + '</h1><p>Modo administrador · ' + e(admin.nombre) + '</p></div>' +
      '<span class="pildora-admin">ADMIN</span>' +
      (volver ? '' : '<div class="barra-admin__acciones"><a href="#/resultados">Ver sitio público</a>' +
        '<button type="button" class="boton boton--claro" data-accion="salir">Salir</button></div>') +
      '</header>';
  }

  // Eventos comunes: ingresar, salir y mostrar la clave.
  function montarAcceso(vista) {
    vista.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-form="ingreso"]');
      if (!form) return;
      ev.preventDefault();
      const error = form.querySelector('.form-error');
      const boton = form.querySelector('[type="submit"]');
      const email = form.email.value.trim();
      const clave = form.clave.value;
      if (!email || !clave) {
        error.textContent = 'Completá usuario y clave.';
        error.hidden = false;
        return;
      }
      boton.disabled = true;
      boton.textContent = 'Ingresando…';
      try {
        await CDM.api.ingresar(email, clave);
        CDM.router.recargar();
      } catch (err) {
        error.textContent = err && err.status === 400 ? 'Usuario o clave incorrectos.' : 'Sin conexión. Probá de nuevo en un rato.';
        error.hidden = false;
        boton.disabled = false;
        boton.textContent = 'Ingresar';
      }
    });
    vista.addEventListener('click', async (ev) => {
      const ver = ev.target.closest('[data-accion="ver-clave"]');
      if (ver) {
        const input = vista.querySelector('#a-pass');
        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';
        ver.setAttribute('aria-pressed', String(mostrar));
        ver.setAttribute('aria-label', mostrar ? 'Ocultar clave' : 'Mostrar clave');
      }
      if (ev.target.closest('[data-accion="salir"]')) {
        await CDM.api.salir();
        location.hash = '#/resultados';
      }
    });
  }

  // Mensaje que queda para mostrar en el panel después de guardar.
  function avisar(texto) {
    try { sessionStorage.setItem('cdm:aviso', texto); } catch (err) { /* sin sessionStorage */ }
  }
  function tomarAviso() {
    try {
      const t = sessionStorage.getItem('cdm:aviso');
      sessionStorage.removeItem('cdm:aviso');
      return t;
    } catch (err) {
      return null;
    }
  }

  // Agrupa Primera y Reserva del mismo partido.
  function agrupar(partidos) {
    const grupos = new Map();
    partidos.forEach((p) => {
      const k = [p.torneo_id, p.fase, p.serie || '', p.fase_orden === 0 ? p.fecha_nro : p.rival_id].join('|');
      if (!grupos.has(k)) grupos.set(k, { clave: k, partidos: [] });
      grupos.get(k).partidos.push(p);
    });
    return [...grupos.values()].map((g) => {
      g.partidos.sort((a, b) => a.categoria.localeCompare(b.categoria));
      g.p = g.partidos.find((x) => x.categoria === 'Primera');
      g.r = g.partidos.find((x) => x.categoria === 'Reserva');
      g.base = g.p || g.r;
      return g;
    });
  }

  return { verificarAcceso, barra, montarAcceso, avisar, tomarAviso, agrupar };
})();

CDM.pantallas.admin = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;

  const FALTANTES = [
    ['programados_vencidos', 'Programados ya pasados sin resultado'],
    ['goles_propios_sin_jugador', 'Goles propios sin jugador'],
    ['goles_propios_no_cuadran', 'Partidos con goleadores que no cuadran'],
    ['fuentes_inexistentes', 'Fuentes citadas que no existen'],
    ['sin_arbitro', 'Partidos jugados sin árbitro'],
    ['sin_formacion', 'Partidos jugados sin formación'],
    ['goles_rival_sin_autor', 'Goles del rival sin autor']
  ];

  const titulo = (g) => g.base.torneo + ' · ' + ui.instanciaLarga(g.base);
  const enfrentamiento = (g) => g.base.local + ' vs ' + g.base.visitante;

  function paraCargar(grupos) {
    const programados = grupos.filter((g) => g.partidos.every((p) => p.estado === 'Programado'))
      .sort((a, b) => String(a.base.fecha || '9999').localeCompare(String(b.base.fecha || '9999')) ||
        a.base.torneo_orden - b.base.torneo_orden || (a.base.fecha_nro || 0) - (b.base.fecha_nro || 0));
    if (!programados.length) return ui.vacio('No hay partidos programados. Usá "+ Partido fuera del fixture" para cargar uno.');
    return programados.map((g, i) => {
      const horas = g.partidos.filter((p) => p.hora).map((p) => p.categoria + ' ' + ui.hora(p.hora));
      const linea = [g.base.cancha, ...horas].filter(Boolean).join(' · ');
      return '<article class="por-cargar' + (i === 0 ? ' por-cargar--proximo' : '') + '"><div class="por-cargar__texto">' +
        '<div class="por-cargar__k">' + e((titulo(g) + ' · ' + (g.base.fecha ? ui.fechaLarga(g.base.fecha).replace(/\/\d{4}$/, '') : 'a confirmar')).toUpperCase()) + '</div>' +
        '<div class="por-cargar__partido">' + e(enfrentamiento(g)) + '</div>' +
        (linea ? '<div class="por-cargar__linea">' + e(linea) + '</div>' : '') + '</div>' +
        '<a class="boton' + (i === 0 ? '' : ' boton--borde') + '" href="#/admin/partido/' + encodeURIComponent(g.base.partido_id) + '">' +
        (i === 0 ? 'Cargar resultado' : 'Editar programación') + '</a></article>';
    }).join('');
  }

  function ultimos(grupos) {
    const jugados = grupos.filter((g) => g.partidos.some((p) => p.estado !== 'Programado'))
      .sort((a, b) => {
        const act = (g) => g.partidos.map((p) => p.actualizado_en || '').sort().pop();
        return act(b).localeCompare(act(a)) || String(b.base.fecha || '').localeCompare(String(a.base.fecha || ''));
      }).slice(0, 10);
    const res = (p) => (p ? (p.goles_local != null ? p.goles_local + '-' + p.goles_visitante : '–') : '');
    const filas = jugados.map((g) => {
      const faltas = [];
      if (g.partidos.some((p) => p.completitud === 'Resultado' && (p.gf || 0) > 0)) faltas.push('faltan goleadores');
      if (g.partidos.some((p) => !p.arbitro)) faltas.push('falta árbitro');
      const datos = faltas.length ? faltas.join(', ') : 'Completo';
      const borrador = g.partidos.some((p) => !p.publicado);
      return '<tr><th scope="row"><span class="ultimos__inst">' + e(ui.instancia(g.base)) + '</span><span class="ultimos__torneo">' +
        e(ui.torneoSinAnio(g.base.torneo) + ' ' + g.base.anio) + '</span></th>' +
        '<td>' + e(enfrentamiento(g)) + '</td><td class="centro"><strong>' + res(g.p) + '</strong></td>' +
        '<td class="centro"><strong>' + res(g.r) + '</strong></td><td class="texto-2">' + e(datos.charAt(0).toUpperCase() + datos.slice(1)) + '</td>' +
        '<td><span class="estado estado--' + (borrador ? 'borrador' : 'publicado') + '">' + (borrador ? 'Borrador' : 'Publicado') + '</span></td>' +
        '<td><a href="#/admin/partido/' + encodeURIComponent(g.base.partido_id) + '" class="enlace-tabla">Editar</a></td></tr>';
    }).join('');
    return '<div class="tabla-scroll"><table class="tabla tabla--ancha tabla--admin"><thead><tr><th>Fecha</th><th>Partido</th>' +
      '<th class="centro">Primera</th><th class="centro">Reserva</th><th>Datos</th><th>Estado</th><th><span class="oculto">Acción</span></th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table></div>';
  }

  function faltantes(f) {
    const items = FALTANTES.filter(([k]) => f[k] > 0)
      .map(([k, texto]) => '<li><span>' + e(texto) + '</span><strong>' + f[k] + '</strong></li>').join('');
    return items ? '<ul class="lista-datos">' + items + '</ul>' : '<p class="nota">No falta nada.</p>';
  }

  function cambios(lista, porId) {
    if (!lista.length) return '<p class="nota">Todavía no hay cambios.</p>';
    const fecha = (f) => {
      const d = new Date(f);
      const dos = (n) => String(n).padStart(2, '0');
      return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + ' · ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
    };
    return '<ul class="cambios">' + lista.map((c) => {
      let que;
      if (c.accion === 'importó') {
        que = 'importó ' + ui.plural(c.partidos, 'partido', 'partidos') + ' del Excel';
      } else {
        const p = porId[c.partido_id];
        que = c.accion + ' ' + (p ? ui.instancia(p) + ' vs ' + p.rival : 'un partido');
      }
      return '<li><strong>' + e(c.usuario) + '</strong> ' + e(que) + (c.es_prueba ? ' <span class="texto-2">(prueba)</span>' : '') +
        '<div class="texto-2">' + e(fecha(c.fecha)) + '</div></li>';
    }).join('') + '</ul>';
  }

  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) return acceso.html;
    const [partidos, falt, listaCambios] = await Promise.all([
      CDM.api.admin.partidos(), CDM.api.admin.faltantes(), CDM.api.admin.cambios()
    ]);
    const grupos = CDM.admin.agrupar(partidos);
    const porId = Object.fromEntries(partidos.map((p) => [p.partido_id, p]));
    const aviso = CDM.admin.tomarAviso();
    return CDM.admin.barra('Panel de carga', acceso.admin) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<div class="detalle"><div class="detalle__principal">' +
      '<section class="por-cargar-lista" aria-label="Para cargar"><h2 class="subtitulo">Para cargar</h2>' + paraCargar(grupos) + '</section>' +
      '<section class="tarjeta" aria-label="Últimos cargados"><div class="tarjeta__cabeza"><h2 class="tarjeta__titulo">Últimos cargados</h2>' +
      '<a href="#/admin/partido/nuevo" class="enlace">+ Partido fuera del fixture</a></div>' + ultimos(grupos) + '</section></div>' +
      '<aside class="detalle__lateral">' +
      '<section class="tarjeta" aria-label="Datos que faltan"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Datos que faltan</h2>' + faltantes(falt) + '</section>' +
      '<section class="tarjeta" aria-label="Registro de cambios"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Registro de cambios</h2>' + cambios(listaCambios, porId) + '</section>' +
      '</aside></div>';
  }

  return { titulo: 'Administrar', seccion: 'admin', render, montar: CDM.admin.montarAcceso };
})();
