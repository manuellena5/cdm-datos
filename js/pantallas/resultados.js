// Resultados (#/resultados). Se completa en la Fase 3.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.resultados = {
  titulo: 'Resultados',
  seccion: 'resultados',
  render(contenedor) {
    contenedor.innerHTML = `
      <h1 class="titulo-pantalla">Resultados</h1>
      <section class="tarjeta pronto">
        <h2 class="pronto__titulo">Pronto</h2>
        <p>Acá vas a ver los partidos de cada torneo, de Primera y de Reserva.</p>
      </section>`;
  }
};
