// Goleadores (#/goleadores). Se completa en la Fase 3.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.goleadores = {
  titulo: 'Goleadores',
  seccion: 'goleadores',
  render(contenedor) {
    contenedor.innerHTML = `
      <h1 class="titulo-pantalla">Goleadores</h1>
      <section class="tarjeta pronto">
        <h2 class="pronto__titulo">Pronto</h2>
        <p>Acá vas a ver los goleadores de Primera y de Reserva por año y por torneo.</p>
      </section>`;
  }
};
