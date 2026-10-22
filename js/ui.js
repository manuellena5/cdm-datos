// Helpers de presentación.
window.CDM = window.CDM || {};

CDM.ui = (function () {
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  // plural(2, 'gol', 'goles') → "2 goles". Nunca "gol(es)".
  function plural(n, sing, plur) {
    return n + ' ' + (n === 1 ? sing : plur);
  }

  // Las fechas llegan como 'AAAA-MM-DD'. Se arman en hora local para que no se corran un día.
  function aFecha(iso) {
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
  }

  const dos = (n) => String(n).padStart(2, '0');

  // '2026-08-02' → '02/08'
  function fechaCorta(iso) {
    const f = aFecha(iso);
    return f ? dos(f.getDate()) + '/' + dos(f.getMonth() + 1) : '';
  }

  // '2026-08-02' → 'dom 02/08/2026'
  function fechaLarga(iso) {
    const f = aFecha(iso);
    return f ? DIAS[f.getDay()] + ' ' + fechaCorta(iso) + '/' + f.getFullYear() : '';
  }

  function escaparHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Etiqueta de resultado: siempre con la letra, nunca solo color. Sin resultado → punteada.
  function chipResultado(r) {
    const letra = ['G', 'E', 'P'].includes(r) ? r : '–';
    const clase = letra === '–' ? 'chip chip--pendiente' : 'chip chip--' + letra;
    const titulo = { G: 'Ganado', E: 'Empatado', P: 'Perdido', '–': 'Por jugar' }[letra];
    return '<span class="' + clase + '" title="' + titulo + '">' + letra + '</span>';
  }

  return { plural, fechaCorta, fechaLarga, escaparHtml, chipResultado };
})();
