// Resultados en modo administrador (#/admin/resultados) — se arma en el punto 6.5.1 del PLAN (mockup 9).
// Por ahora, una pantalla provisoria para que el ítem del menú no lleve a otro lado.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminResultados = (function () {
  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) return acceso.html;
    return CDM.admin.barra('Resultados', acceso.admin, { actual: 'resultados' }) +
      '<section class="tarjeta vacio"><h2 class="vacio__titulo">Pronto</h2>' +
      '<p>Acá vas a ver todas las fechas de cada torneo, con lo que falta cargar en cada partido.</p>' +
      '<p>Mientras tanto, lo pendiente está en el <a href="#/admin">Panel</a>.</p></section>';
  }

  return { titulo: 'Resultados (admin)', seccion: 'admin', render, montar: (vista) => CDM.admin.montarAcceso(vista) };
})();
