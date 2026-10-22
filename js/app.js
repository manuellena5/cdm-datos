// Arranque: versión en el pie, estado de la conexión y enrutado.
(function () {
  const MENSAJES = {
    'conectado': { texto: 'Conectado', clase: 'conexion--ok' },
    'sin-configurar': { texto: 'Todavía no hay base conectada.', clase: 'conexion--error' },
    'sin-conexion': { texto: 'Sin conexión con la base. Probá de nuevo en un rato.', clase: 'conexion--error' }
  };

  document.getElementById('pie-version').textContent = CDM.config.APP_VERSION;

  async function mostrarConexion() {
    const el = document.getElementById('pie-conexion');
    const estado = await CDM.api.probarConexion();
    const m = MENSAJES[estado];
    el.textContent = m.texto;
    el.className = 'conexion ' + m.clase;
  }

  CDM.router.iniciar();
  mostrarConexion();
})();
