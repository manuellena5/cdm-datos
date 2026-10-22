// Historial (#/historial). Se completa en la Fase 3.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.historial = {
  titulo: 'Historial',
  seccion: 'historial',
  render(contenedor) {
    contenedor.innerHTML = `
      <h1 class="titulo-pantalla">Historial</h1>
      <section class="tarjeta pronto">
        <h2 class="pronto__titulo">Pronto</h2>
        <p>Acá vas a ver las campañas de cada torneo y el historial contra cada rival.</p>
      </section>`;
  }
};
