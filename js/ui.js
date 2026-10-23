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

  // '16:30:00' → '16:30'
  function hora(h) {
    return h ? String(h).slice(0, 5) : '';
  }

  function escaparHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  const e = escaparHtml;

  // Etiqueta de resultado: siempre con la letra, nunca solo color. Sin resultado → punteada.
  function chipResultado(r, titulo) {
    const letra = ['G', 'E', 'P'].includes(r) ? r : '–';
    const clase = letra === '–' ? 'chip chip--pendiente' : 'chip chip--' + letra;
    const t = titulo || { G: 'Ganado', E: 'Empatado', P: 'Perdido', '–': 'Sin resultado' }[letra];
    return '<span class="' + clase + '" title="' + e(t) + '">' + letra + '</span>';
  }

  // 'Apertura 2026' → 'Apertura'
  function torneoSinAnio(nombre) {
    return String(nombre || '').replace(/\s+\d{4}$/, '');
  }

  // 'Octavos' / 'Cuartos' (Ida) / 'F7'
  function instancia(p) {
    if (p.fase_orden > 0) return p.fase + (p.serie ? ' (' + p.serie.toLowerCase() + ')' : '');
    return p.fecha_nro ? 'F' + p.fecha_nro : '';
  }

  function instanciaLarga(p) {
    if (p.fase_orden > 0) return instancia(p);
    return p.fecha_nro ? 'Fecha ' + p.fecha_nro : 'Fase regular';
  }

  // Marcador local - visitante, o la hora si está programado.
  function marcador(p) {
    if (p.goles_local != null) return p.goles_local + ' - ' + p.goles_visitante;
    if (p.estado === 'Programado') return hora(p.hora) || 'A conf.';
    if (p.resultado) return { G: 'Ganó', E: 'Empató', P: 'Perdió' }[p.resultado];
    return '–';
  }

  function penales(p) {
    return p.penales_local != null ? p.penales_local + '-' + p.penales_visitante + ' pen.' : '';
  }

  function tituloChip(p) {
    if (p.estado === 'Programado') return 'Por jugar';
    if (p.estado === 'Postergado') return 'Postergado';
    if (!p.resultado) return 'Sin dato';
    return null;
  }

  // ---------- Íconos (SVG en línea, decorativos) ----------
  const svg = (contenido, clase) =>
    '<svg class="icono ' + (clase || '') + '" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">' + contenido + '</svg>';
  const ICONOS = {
    'Roja': svg('<rect x="7" y="3" width="10" height="16" rx="2" fill="#C62828"/>'),
    'Doble amarilla': svg('<rect x="4" y="5" width="9" height="14" rx="2" fill="#F2C200"/><rect x="11" y="3" width="9" height="14" rx="2" fill="#C62828"/>'),
    'Amarilla': svg('<rect x="7" y="3" width="10" height="16" rx="2" fill="#F2C200"/>'),
    'Penal errado': svg('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2"/>'),
    'Penal atajado': svg('<path d="M5 13V7a2 2 0 014 0v4M9 11V5a2 2 0 014 0v6M13 11V6a2 2 0 014 0v7c0 4-3 7-6 7s-6-3-6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
    'Expulsión del DT': svg('<circle cx="12" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="16" y="2" width="5" height="8" rx="1" fill="#C62828"/>'),
    'Lesión': svg('<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill="#C62828"/>'),
    'Partido suspendido': svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8v8M14 8v8" stroke="currentColor" stroke-width="2"/>'),
    'Otra': svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7v1" stroke="currentColor" stroke-width="2"/>')
  };
  function icono(tipo) {
    return ICONOS[tipo] || ICONOS['Otra'];
  }

  // Ícono chico de roja con la cantidad, para las tarjetas de partido.
  function rojas(n) {
    if (!n) return '';
    return '<span class="rojas" title="' + e(plural(n, 'expulsión', 'expulsiones')) + '">' +
      ICONOS['Roja'] + (n > 1 ? '<span>' + n + '</span>' : '') + '</span>';
  }

  // ---------- Controles ----------
  function selector(id, etiqueta, opciones, valor, extra) {
    return '<div class="campo ' + (extra || '') + '"><label for="' + id + '">' + e(etiqueta) + '</label>' +
      '<select id="' + id + '" data-filtro="' + id + '">' +
      opciones.map((o) => '<option value="' + e(o.valor) + '"' + (String(o.valor) === String(valor) ? ' selected' : '') + '>' +
        e(o.texto) + '</option>').join('') +
      '</select></div>';
  }

  function segmentado(nombre, etiqueta, opciones, valor) {
    return '<div class="campo"><span class="campo__etiqueta" id="seg-' + nombre + '">' + e(etiqueta) + '</span>' +
      '<div class="segmentado" role="group" aria-labelledby="seg-' + nombre + '">' +
      opciones.map((o) => '<button type="button" data-seg="' + nombre + '" data-valor="' + e(o.valor) + '" aria-pressed="' +
        (o.valor === valor) + '">' + e(o.texto) + '</button>').join('') +
      '</div></div>';
  }

  // ---------- Estados de carga ----------
  function cargando() {
    return '<p class="estado-carga" role="status">Cargando…</p>';
  }

  function errorCarga(err) {
    const sinConexion = err && (err.message === 'sin-conexion' || err.message === 'sin-configurar');
    return '<section class="tarjeta vacio"><h2 class="vacio__titulo">' +
      (sinConexion ? 'Sin conexión' : 'No pudimos cargar los datos') + '</h2><p>' +
      (sinConexion ? 'No hay datos guardados para mostrar. Probá de nuevo en un rato.' : 'Probá de nuevo en un rato.') +
      '</p></section>';
  }

  function avisoGuardados() {
    return '<div class="aviso" role="status">Sin conexión. Estás viendo los últimos datos guardados.</div>';
  }

  function vacio(texto) {
    return '<div class="vacio vacio--chico">' + e(texto) + '</div>';
  }

  // ---------- Escudos ----------
  // 'Juv. Unida' → 'JU', 'San Martín (CP)' → 'SM', 'Trebolense' → 'TR'
  function iniciales(nombre) {
    const palabras = String(nombre || '').replace(/\(.*?\)/g, ' ').split(/[\s.]+/).filter(Boolean);
    if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
    return palabras.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
  }

  // Escudo del equipo a `px` píxeles. Sin imagen: círculo gris con las iniciales, del mismo tamaño.
  // El club propio, si no tiene escudo cargado, usa el del repo.
  function escudo(equipo, px) {
    const tam = 'width:' + px + 'px;height:' + px + 'px';
    const src = equipo && (equipo.escudo || (equipo.es_propio ? 'assets/escudo-192.png' : ''));
    if (src) {
      return '<img class="escudo" src="' + e(src) + '" alt="" width="' + px + '" height="' + px + '" loading="lazy" style="' + tam + '">';
    }
    return '<span class="escudo escudo--iniciales" aria-hidden="true" style="' + tam + ';font-size:' + Math.max(9, Math.round(px * 0.4)) + 'px">' +
      e(iniciales(equipo ? equipo.nombre_corto : '')) + '</span>';
  }

  // Une nombres: ['A', 'B', 'C'] → 'A, B y C'
  function unir(nombres) {
    if (nombres.length <= 1) return nombres.join('');
    return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  }

  return {
    plural, fechaCorta, fechaLarga, hora, escaparHtml, chipResultado, torneoSinAnio, instancia, instanciaLarga,
    marcador, penales, tituloChip, icono, rojas, selector, segmentado, cargando, errorCarga, avisoGuardados,
    vacio, unir, escudo, iniciales
  };
})();
