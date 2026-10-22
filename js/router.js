// Enrutado por hash: #/resultados, #/partido/:id, #/goleadores, #/historial, #/admin.
// Los filtros van en la query del hash: #/resultados?anio=2026&torneo=C&cat=P
window.CDM = window.CDM || {};

CDM.router = (function () {
  const RUTAS = [
    { patron: /^\/resultados$/, pantalla: 'resultados' },
    { patron: /^\/partido\/([^/]+)$/, pantalla: 'detalle', claves: ['id'] },
    { patron: /^\/goleadores$/, pantalla: 'goleadores' },
    { patron: /^\/historial$/, pantalla: 'historial' },
    { patron: /^\/admin$/, pantalla: 'admin' }
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

  function mostrar() {
    const { ruta, query } = leerHash();
    const destino = resolver(ruta);
    if (!destino) {
      location.replace(RUTA_INICIAL);
      return;
    }
    const pantalla = CDM.pantallas[destino.nombre];
    const contenedor = document.getElementById('contenido');
    marcarNav(pantalla.seccion);
    document.title = pantalla.titulo + ' · Historial Mitre';
    pantalla.render(contenedor, destino.params, query);
    window.scrollTo(0, 0);
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

  return { iniciar, armar };
})();
