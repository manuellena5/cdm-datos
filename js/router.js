// Enrutado por hash: #/resultados, #/partido/:id, #/goleadores, #/historial, #/admin.
// Los filtros van en la query del hash: #/resultados?anio=2026&torneo=C&cat=P
window.CDM = window.CDM || {};

CDM.router = (function () {
  const RUTAS = [
    { patron: /^\/resultados$/, pantalla: 'resultados' },
    { patron: /^\/partido\/([^/]+)$/, pantalla: 'detalle', claves: ['id'] },
    { patron: /^\/goleadores$/, pantalla: 'goleadores' },
    { patron: /^\/historial$/, pantalla: 'historial' },
    { patron: /^\/historial\/rival\/([^/]+)$/, pantalla: 'historialRival', claves: ['id'] },
    { patron: /^\/planteles$/, pantalla: 'planteles' },
    { patron: /^\/jugador\/([^/]+)$/, pantalla: 'jugador', claves: ['id'] },
    { patron: /^\/admin$/, pantalla: 'admin' },
    { patron: /^\/admin\/partido\/([^/]+)$/, pantalla: 'adminPartido', claves: ['id'] },
    { patron: /^\/admin\/jugadores$/, pantalla: 'adminJugadores' },
    { patron: /^\/admin\/jugadores\/duplicados$/, pantalla: 'adminDuplicados' },
    { patron: /^\/admin\/equipos$/, pantalla: 'adminEquipos' },
    { patron: /^\/admin\/planteles$/, pantalla: 'adminPlanteles' },
    { patron: /^\/admin\/resultados$/, pantalla: 'adminResultados' }
  ];
  const RUTA_INICIAL = '#/resultados';

  // '#/partido/2026C-F07-P?x=1' → { ruta: '/partido/2026C-F07-P', query: URLSearchParams }
  function leerHash() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [ruta, q = ''] = hash.split('?');
    return { ruta, query: new URLSearchParams(q) };
  }

  function resolver(ruta) {
    for (const r of RUTAS) {
      const m = ruta.match(r.patron);
      if (!m) continue;
      const params = {};
      (r.claves || []).forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { nombre: r.pantalla, params };
    }
    return null;
  }

  function marcarNav(seccion) {
    document.querySelectorAll('[data-seccion]').forEach((a) => {
      if (a.dataset.seccion === seccion) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  let turno = 0;
  let ultimaRuta = null;

  // Cada pantalla tiene render(params, query) → HTML (puede ser una promesa)
  // y, opcional, montar(contenedor, params, query) para enganchar eventos.
  // Si mientras carga se navega a otra pantalla, la respuesta vieja se descarta.
  async function mostrar() {
    const { ruta, query } = leerHash();
    const destino = resolver(ruta);
    if (!destino) {
      location.replace(RUTA_INICIAL);
      return;
    }
    const miTurno = ++turno;
    const pantalla = CDM.pantallas[destino.nombre];
    const contenedor = document.getElementById('contenido');
    const mismaRuta = ruta === ultimaRuta;   // solo cambiaron los filtros
    ultimaRuta = ruta;
    marcarNav(pantalla.seccion);
    document.title = pantalla.titulo + ' · Historial Mitre';
    CDM.api.empezarPantalla();
    if (!mismaRuta) contenedor.innerHTML = CDM.ui.cargando();

    let html;
    let fallo = false;
    try {
      html = await pantalla.render(destino.params, query);
    } catch (e) {
      html = CDM.ui.errorCarga(e);
      fallo = true;
    }
    if (miTurno !== turno) return;
    // Un contenedor nuevo por render: los eventos de la pantalla anterior se van con él.
    const vista = document.createElement('div');
    vista.className = 'vista';
    vista.innerHTML = (CDM.api.usandoGuardados && !fallo ? CDM.ui.avisoGuardados() : '') + html;
    contenedor.replaceChildren(vista);
    if (pantalla.montar) pantalla.montar(vista, destino.params, query);
    // Menú de admin en el celular: que se vea el ítem de la pantalla actual
    const actualMenu = vista.querySelector('.menu-admin [aria-current="page"]');
    if (actualMenu) actualMenu.parentElement.scrollLeft = actualMenu.offsetLeft - 12;
    if (!mismaRuta) window.scrollTo(0, 0);
  }

  // Cambia filtros sin sumar una entrada al historial del navegador.
  function cambiarFiltros(ruta, filtros) {
    location.replace(armar(ruta, filtros));
  }

  // Arma un hash con filtros, sin valores vacíos: armar('/resultados', { anio: 2026, cat: 'P' })
  function armar(ruta, filtros) {
    const q = new URLSearchParams();
    Object.entries(filtros || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, v);
    });
    const texto = q.toString();
    return '#' + ruta + (texto ? '?' + texto : '');
  }

  function iniciar() {
    window.addEventListener('hashchange', mostrar);
    mostrar();
  }

  // Vuelve a dibujar la pantalla actual (por ejemplo, después de ingresar).
  function recargar() {
    ultimaRuta = null;
    return mostrar();
  }

  return { iniciar, armar, cambiarFiltros, recargar };
})();
