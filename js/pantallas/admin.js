// Administración (#/admin). Ingreso y carga de partidos en la Fase 4.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.admin = {
  titulo: 'Administrar',
  seccion: 'admin',
  render(contenedor) {
    contenedor.innerHTML = `
      <h1 class="titulo-pantalla">Administrar</h1>
      <section class="tarjeta pronto">
        <h2 class="pronto__titulo">Pronto</h2>
        <p>Acá vas a poder cargar los resultados de cada fecha.</p>
      </section>
      <p><a href="#/resultados">Volver al historial</a></p>`;
  }
};
