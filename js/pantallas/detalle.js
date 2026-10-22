// Detalle del partido (#/partido/:id). Se completa en la Fase 3.
// El id se usa para buscar el partido, nunca se muestra en pantalla.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.detalle = {
  titulo: 'Partido',
  seccion: 'resultados',
  render(contenedor) {
    contenedor.innerHTML = `
      <h1 class="titulo-pantalla">Detalle del partido</h1>
      <section class="tarjeta pronto">
        <h2 class="pronto__titulo">Pronto</h2>
        <p>Acá vas a ver los goles, las incidencias y la formación de cada partido.</p>
      </section>
      <p><a href="#/resultados">Volver a resultados</a></p>`;
  }
};
