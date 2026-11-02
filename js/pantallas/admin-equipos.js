// Equipos (#/admin/equipos) — PLAN 4.5.4 (escudos) y 6.7.1 (datos de cada club).
// Nombre, nombre corto, localidad y estadio se guardan solos al salir de cada campo. El estadio es el que
// completa la carga del partido cuando el equipo juega de local.
// Las imágenes se suben a Supabase Storage (bucket público "escudos"): no hace falta un commit para cambiarlas.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminEquipos = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  const MAX_BYTES = 1024 * 1024;
  const CAMPOS = [['nombre', 'Nombre'], ['nombre_corto', 'Nombre corto'], ['localidad', 'Localidad'], ['cancha', 'Estadio']];
  let ctx = null;

  const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Estadio más usado por cada equipo cuando jugó de local
  function sugerencias(partidos) {
    const cuenta = new Map();
    partidos.filter((p) => p.cancha).forEach((p) => {
      const k = p.local_id + '|' + p.cancha.trim();
      cuenta.set(k, (cuenta.get(k) || 0) + 1);
    });
    const r = {};
    [...cuenta].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
      const [id, cancha] = k.split('|');
      if (!r[id]) r[id] = { cancha, n };
    });
    return r;
  }

  // ID nuevo a partir del nombre corto: 'Juv. Unida' → 'JUN', 'Trebolense' → 'TRE'; si ya existe, termina en número.
  function nuevoId(nombreCorto) {
    const palabras = sinAcentos(nombreCorto).toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean);
    let base = palabras.length > 1 ? palabras.slice(0, 3).map((p) => p[0]).join('') : '';
    base = (base + (palabras[palabras.length - 1] || 'EQU').slice(base.length ? 1 : 0)).slice(0, 3).padEnd(3, 'X');
    const usados = new Set(ctx.equipos.map((x) => x.equipo_id));
    if (!usados.has(base)) return base;
    for (let i = 2; i < 100; i++) {
      const id = base.slice(0, 3 - String(i).length) + i;
      if (!usados.has(id)) return id;
    }
    return base + Date.now();
  }

  function sugerenciaHtml(x) {
    const s = ctx.sugeridas[x.equipo_id];
    if (x.cancha || !s) return '';
    return '<p class="equipo__sugerencia">Jugó de local en <strong>' + e(s.cancha) + '</strong> (' + ui.plural(s.n, 'partido', 'partidos') + ') ' +
      '<button type="button" class="enlace-boton" data-usar="' + e(x.equipo_id) + '">Usar este</button></p>';
  }

  function equipoHtml(x) {
    return '<li class="equipo equipo--datos" data-id="' + e(x.equipo_id) + '">' + ui.escudo(x, 48) +
      '<div class="equipo__datos"><div class="equipo__campos">' + CAMPOS.map(([k, t]) =>
        '<div class="campo"><label for="eq-' + e(x.equipo_id) + '-' + k + '">' + t + '</label>' +
        '<input id="eq-' + e(x.equipo_id) + '-' + k + '" data-campo="' + k + '" value="' + e(x[k] || '') + '" autocomplete="off"' +
        (k === 'cancha' ? ' list="estadios"' : '') + (k === 'localidad' || k === 'cancha' ? ' placeholder="Sin cargar"' : ' required') + '></div>').join('') +
      '</div>' + sugerenciaHtml(x) + '<p class="plantel-estado" role="status"></p></div>' +
      '<div class="equipo__acciones"><label class="boton boton--borde boton-archivo">' + (x.escudo ? 'Cambiar escudo' : 'Subir escudo') +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-equipo="' + e(x.equipo_id) + '" class="oculto"></label>' +
      (x.escudo ? '<button type="button" class="enlace-boton" data-quitar="' + e(x.equipo_id) + '">Quitar escudo</button>' : '') +
      '</div></li>';
  }

  function nuevoHtml() {
    return '<details class="tarjeta equipo-nuevo"><summary class="tarjeta__titulo tarjeta__titulo--chico">+ Equipo</summary>' +
      '<form data-form="equipo-nuevo" class="equipo-nuevo__form"><div class="equipo__campos">' + CAMPOS.map(([k, t]) =>
        '<div class="campo"><label for="nuevo-' + k + '">' + t + '</label><input id="nuevo-' + k + '" name="' + k + '" autocomplete="off"' +
        (k === 'cancha' ? ' list="estadios"' : '') + (k === 'nombre' || k === 'nombre_corto' ? ' required' : '') + '></div>').join('') + '</div>' +
      '<p class="nota">El nombre corto es el que se ve en Resultados y en las tablas ("Juv. Unida").</p>' +
      '<button type="submit" class="boton">Agregar equipo</button></form></details>';
  }

  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) { ctx = null; return acceso.html; }
    const [equipos, partidos] = await Promise.all([CDM.api.admin.equipos(), CDM.api.admin.partidos()]);
    // Mitre primero, después los rivales por nombre corto
    equipos.sort((a, b) => (b.es_propio - a.es_propio) || a.nombre_corto.localeCompare(b.nombre_corto, 'es'));
    ctx = { equipos, sugeridas: sugerencias(partidos) };
    const estadios = [...new Set(equipos.map((x) => x.cancha).concat(partidos.map((p) => p.cancha)).filter(Boolean).map((c) => c.trim()))]
      .sort((a, b) => a.localeCompare(b, 'es'));
    const aviso = CDM.admin.tomarAviso();
    const sinEscudo = equipos.filter((x) => !x.escudo && !x.es_propio).length;
    const sinEstadio = equipos.filter((x) => !x.cancha).length;
    const paraUsar = equipos.filter((x) => !x.cancha && ctx.sugeridas[x.equipo_id]).length;
    return CDM.admin.barra('Equipos', acceso.admin, { actual: 'equipos' }) +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' + nuevoHtml() +
      '<section class="tarjeta" aria-label="Equipos"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Equipos (' + equipos.length + ')</h2>' +
      '<p class="nota">El estadio se completa solo en la carga del partido cuando el equipo juega de local. ' +
      (sinEstadio ? ui.plural(sinEstadio, 'equipo sin estadio', 'equipos sin estadio') + '. ' : '') +
      'Escudo: imagen cuadrada, de unos 128 px y con fondo transparente (PNG); sin escudo se muestran las iniciales' +
      (sinEscudo ? ' (' + ui.plural(sinEscudo, 'equipo sin escudo', 'equipos sin escudo') + ')' : '') + '.</p>' +
      (paraUsar ? '<button type="button" class="boton boton--borde" data-accion="usar-todos">Usar los ' + paraUsar + ' estadios sugeridos</button>' : '') +
      '<datalist id="estadios">' + estadios.map((c) => '<option value="' + e(c) + '">').join('') + '</datalist>' +
      '<ul class="equipos">' + equipos.map(equipoHtml).join('') + '</ul></section>';
  }

  function montar(vista) {
    CDM.admin.montarAcceso(vista);
    if (!ctx) return;
    const error = (texto) => {
      const p = vista.querySelector('.form-error');
      p.textContent = texto;
      p.hidden = !texto;
      if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    const estado = (li, texto) => {
      const s = li.querySelector('.plantel-estado');
      s.textContent = texto;
      clearTimeout(s._t);
      s._t = setTimeout(() => { s.textContent = ''; }, 4000);
    };

    async function guardar(li, campo, valor) {
      const x = ctx.equipos.find((q) => q.equipo_id === li.dataset.id);
      const v = valor.trim();
      const input = li.querySelector('[data-campo="' + campo + '"]');
      if ((campo === 'nombre' || campo === 'nombre_corto') && !v) { input.value = x[campo]; return error('El nombre no puede quedar vacío.'); }
      if ((x[campo] || '') === v) return;
      try {
        await CDM.api.admin.editarEquipo(x.equipo_id, { [campo]: v || null });
        x[campo] = v || null;
        error('');
        estado(li, 'Guardado');
        const s = li.querySelector('.equipo__sugerencia');
        if (campo === 'cancha' && s) s.remove();
      } catch (err) {
        error(err.message);
      }
    }

    vista.addEventListener('change', async (ev) => {
      const campo = ev.target.dataset.campo;
      if (campo) return guardar(ev.target.closest('[data-id]'), campo, ev.target.value);
      const id = ev.target.dataset.equipo;
      const archivo = ev.target.files && ev.target.files[0];
      if (!id || !archivo) return;
      if (!/^image\//.test(archivo.type)) return error('El archivo tiene que ser una imagen (PNG, JPG, WEBP o SVG).');
      if (archivo.size > MAX_BYTES) return error('La imagen pesa más de 1 MB. Achicala a unos 128 px y probá de nuevo.');
      const etiqueta = ev.target.closest('label');
      etiqueta.classList.add('boton--cargando');
      etiqueta.firstChild.textContent = 'Subiendo…';
      try {
        await CDM.api.admin.subirEscudo(id, archivo);
        CDM.admin.avisar('Escudo guardado.');
        CDM.router.recargar();
      } catch (err) {
        error(err.message);
        etiqueta.classList.remove('boton--cargando');
        etiqueta.firstChild.textContent = 'Subir escudo';
      }
    });

    vista.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.dataset.campo) { ev.preventDefault(); ev.target.blur(); }
    });

    vista.addEventListener('click', async (ev) => {
      const usar = ev.target.closest('[data-usar]');
      if (usar) {
        const li = usar.closest('[data-id]');
        const input = li.querySelector('[data-campo="cancha"]');
        input.value = ctx.sugeridas[usar.dataset.usar].cancha;
        return guardar(li, 'cancha', input.value);
      }
      const todos = ev.target.closest('[data-accion="usar-todos"]');
      if (todos) {
        todos.disabled = true;
        try {
          const lista = ctx.equipos.filter((x) => !x.cancha && ctx.sugeridas[x.equipo_id]);
          for (const x of lista) await CDM.api.admin.editarEquipo(x.equipo_id, { cancha: ctx.sugeridas[x.equipo_id].cancha });
          CDM.admin.avisar('Estadio cargado en ' + ui.plural(lista.length, 'equipo', 'equipos') + '.');
          CDM.router.recargar();
        } catch (err) { todos.disabled = false; error(err.message); }
        return;
      }
      const b = ev.target.closest('[data-quitar]');
      if (!b) return;
      if (!window.confirm('¿Quitar el escudo? Se van a ver las iniciales.')) return;
      try {
        await CDM.api.admin.quitarEscudo(b.dataset.quitar);
        CDM.admin.avisar('Escudo quitado.');
        CDM.router.recargar();
      } catch (err) {
        error(err.message);
      }
    });

    vista.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-form="equipo-nuevo"]');
      if (!form) return;
      ev.preventDefault();
      const v = (k) => form[k].value.trim();
      if (!v('nombre') || !v('nombre_corto')) return error('Completá el nombre y el nombre corto.');
      const repetido = ctx.equipos.find((x) => sinAcentos(x.nombre_corto).toLowerCase() === sinAcentos(v('nombre_corto')).toLowerCase());
      if (repetido) return error('Ya hay un equipo con el nombre corto "' + repetido.nombre_corto + '".');
      const boton = form.querySelector('[type="submit"]');
      boton.disabled = true;
      try {
        await CDM.api.admin.crearEquipo({
          equipo_id: nuevoId(v('nombre_corto')), nombre: v('nombre'), nombre_corto: v('nombre_corto'),
          localidad: v('localidad') || null, cancha: v('cancha') || null, es_propio: false
        });
        CDM.admin.avisar('Equipo agregado: ' + v('nombre_corto') + '.');
        CDM.router.recargar();
      } catch (err) {
        boton.disabled = false;
        error(err.message);
      }
    });
  }

  return { titulo: 'Equipos', seccion: 'admin', render, montar };
})();
