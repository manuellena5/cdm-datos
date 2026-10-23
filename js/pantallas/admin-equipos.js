// Escudos de los equipos (#/admin/equipos) — PLAN 4.5.4.
// Las imágenes se suben a Supabase Storage (bucket público "escudos"): no hace falta un commit para cambiarlas.
window.CDM = window.CDM || {};
CDM.pantallas = CDM.pantallas || {};

CDM.pantallas.adminEquipos = (function () {
  const { ui } = CDM;
  const e = ui.escaparHtml;
  const MAX_BYTES = 1024 * 1024;

  async function render() {
    const acceso = await CDM.admin.verificarAcceso();
    if (!acceso.admin) return acceso.html;
    const equipos = await CDM.api.admin.equipos();
    const aviso = CDM.admin.tomarAviso();
    const sinEscudo = equipos.filter((x) => !x.escudo && !x.es_propio).length;
    return CDM.admin.barra('Equipos', acceso.admin, '#/admin') +
      (aviso ? '<div class="aviso aviso--ok" role="status">' + e(aviso) + '</div>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      '<section class="tarjeta" aria-label="Escudos"><h2 class="tarjeta__titulo tarjeta__titulo--chico">Escudos</h2>' +
      '<p class="nota">Imagen cuadrada, de unos 128 px y con fondo transparente (PNG). Sin escudo se muestran las iniciales. ' +
      (sinEscudo ? ui.plural(sinEscudo, 'equipo sin escudo', 'equipos sin escudo') + '.' : 'Todos los equipos tienen escudo.') + '</p>' +
      '<ul class="equipos">' + equipos.map((x) => '<li class="equipo">' + ui.escudo(x, 48) +
        '<div class="equipo__datos"><div class="jugador__nombre">' + e(x.nombre_corto) + '</div><div class="texto-2">' + e(x.nombre) + '</div></div>' +
        '<div class="equipo__acciones"><label class="boton boton--borde boton-archivo">' + (x.escudo ? 'Cambiar' : 'Subir escudo') +
        '<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-equipo="' + e(x.equipo_id) + '" class="oculto"></label>' +
        (x.escudo ? '<button type="button" class="enlace-boton" data-quitar="' + e(x.equipo_id) + '">Quitar</button>' : '') +
        '</div></li>').join('') + '</ul></section>';
  }

  function montar(vista) {
    CDM.admin.montarAcceso(vista);
    const error = (texto) => {
      const p = vista.querySelector('.form-error');
      p.textContent = texto;
      p.hidden = !texto;
      if (texto) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    vista.addEventListener('change', async (ev) => {
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
    vista.addEventListener('click', async (ev) => {
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
  }

  return { titulo: 'Equipos', seccion: 'admin', render, montar };
})();
