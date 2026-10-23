// Todas las llamadas a Supabase pasan por acá.
// Lo ya pedido queda en memoria; la última respuesta de cada consulta se guarda
// en localStorage para mostrar algo si no hay conexión.
window.CDM = window.CDM || {};

CDM.api = (function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = CDM.config;
  const configurada = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const PREFIJO = 'cdm:v1:';
  const POR_PAGINA = 1000;
  const ESPERA_MS = 10000;
  const REINTENTO_MS = 30000;   // tras quedarse sin red, se usa lo guardado sin volver a esperar
  let sinRedHasta = 0;

  let cliente = null;
  if (configurada && window.supabase) {
    cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const memoria = new Map();
  let usandoGuardados = false;   // true si alguna consulta de la pantalla actual vino de lo guardado

  // Devuelve 'conectado' | 'sin-configurar' | 'sin-conexion'. Nunca lanza.
  async function probarConexion() {
    if (!configurada) return 'sin-configurar';
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 8000);
    try {
      const resp = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/health', {
        headers: { apikey: SUPABASE_ANON_KEY },
        signal: control.signal
      });
      return resp.ok ? 'conectado' : 'sin-conexion';
    } catch (e) {
      return 'sin-conexion';
    } finally {
      clearTimeout(espera);
    }
  }

  function leerGuardado(clave) {
    try {
      const texto = localStorage.getItem(PREFIJO + clave);
      return texto ? JSON.parse(texto).datos : undefined;
    } catch (e) {
      return undefined;
    }
  }

  function guardar(clave, datos) {
    try {
      localStorage.setItem(PREFIJO + clave, JSON.stringify({ t: Date.now(), datos }));
    } catch (e) { /* sin lugar o bloqueado: seguimos sin guardar */ }
  }

  // Trae todas las filas de una consulta, de a páginas. Sin respuesta en ESPERA_MS
  // se corta (sin esto, sin red se queda reintentando un buen rato).
  async function todas(armar) {
    let filas = [];
    for (let desde = 0; ; desde += POR_PAGINA) {
      const { data, error } = await armar().range(desde, desde + POR_PAGINA - 1)
        .abortSignal(AbortSignal.timeout(ESPERA_MS));
      if (error) throw error;
      filas = filas.concat(data);
      if (data.length < POR_PAGINA) return filas;
    }
  }

  // Ejecuta una consulta con caché. Si falla y hay algo guardado, devuelve eso.
  // Si falla y no hay nada, lanza Error('sin-conexion') o Error('error-servidor').
  function consultar(clave, armar) {
    if (memoria.has(clave)) return memoria.get(clave);
    const promesa = (async () => {
      if (!cliente) throw new Error('sin-configurar');
      let motivo = 'sin-conexion';
      if (Date.now() >= sinRedHasta) {
        try {
          const datos = await todas(armar);
          guardar(clave, datos);
          return datos;
        } catch (e) {
          // Con código, el servidor respondió con un error; sin código, no hubo conexión.
          if (e && e.code) motivo = 'error-servidor';
          else sinRedHasta = Date.now() + REINTENTO_MS;
        }
      }
      memoria.delete(clave);
      const guardado = leerGuardado(clave);
      if (guardado !== undefined) {
        usandoGuardados = true;
        return guardado;
      }
      throw new Error(motivo);
    })();
    memoria.set(clave, promesa);
    return promesa;
  }

  const lista = (ids) => [...new Set(ids)].sort();

  // Después de guardar (o al entrar o salir) la consulta tiene que volver a pedir todo.
  function olvidarCache() {
    memoria.clear();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* bloqueado: nada que borrar */ }
    sinRedHasta = 0;
  }

  // Llama a una función de la base. Los errores salen con un mensaje para el usuario.
  async function llamar(funcion, parametros) {
    let res;
    try {
      res = await cliente.rpc(funcion, parametros).abortSignal(AbortSignal.timeout(20000));
    } catch (e) {
      throw new Error('Sin conexión. No se guardó; probá de nuevo.');
    }
    if (res.error) {
      const e = res.error;
      if (!e.code) throw new Error('Sin conexión. No se guardó; probá de nuevo.');
      if (e.code === '42501' || /permiso|permission/i.test(e.message)) throw new Error('Tu usuario no tiene permiso para cargar datos.');
      if (e.code === 'PGRST301' || /JWT/i.test(e.message)) throw new Error('Se cerró la sesión. Volvé a ingresar.');
      throw new Error('No se pudo guardar. Revisá los datos y probá de nuevo.');
    }
    olvidarCache();
    return res.data;
  }

  const COLUMNAS_PARTIDO = [
    'partido_id', 'torneo_id', 'anio', 'torneo', 'torneo_tipo', 'torneo_orden', 'fase', 'fase_orden',
    'zona', 'serie', 'fecha_nro', 'fecha', 'hora', 'categoria', 'local', 'visitante',
    'goles_local', 'goles_visitante', 'penales_local', 'penales_visitante', 'condicion',
    'rival_id', 'rival', 'gf', 'gc', 'penales_favor', 'penales_contra', 'resultado',
    'goles_mitre_texto', 'rojas', 'cancha', 'arbitro', 'estado', 'completitud', 'fuente_ids'
  ].join(',');

  return {
    cliente,
    configurada,
    probarConexion,

    // Al cambiar de pantalla: avisar si lo que se muestra vino de lo guardado.
    empezarPantalla() { usandoGuardados = false; },
    get usandoGuardados() { return usandoGuardados; },

    clubPropio: () => consultar('club_propio', () =>
      cliente.from('equipos').select('nombre,nombre_corto').eq('es_propio', true))
      .then((filas) => filas[0] || { nombre: '', nombre_corto: '' }),

    // La consulta pública muestra solo lo publicado, aunque haya sesión iniciada.
    partidos: () => consultar('partidos', () =>
      cliente.from('v_partidos').select(COLUMNAS_PARTIDO).eq('publicado', true).order('partido_id')),

    campanas: () => consultar('campanas', () =>
      cliente.from('v_campanas').select('*').order('torneo_orden').order('categoria')),

    goleadores: () => consultar('goleadores', () =>
      cliente.from('v_goleadores').select('*').order('jugador_id').order('torneo_id').order('categoria')),

    goleadoresLiga: () => consultar('goleadores_liga', () =>
      cliente.from('goleadores_liga').select('torneo_id,categoria,jugador_id,goles,puesto').order('id')),

    historialRival: () => consultar('historial_rival', () =>
      cliente.from('v_historial_rival').select('*').order('rival_id').order('categoria').order('anio')),

    golesDe: (ids) => consultar('goles:' + lista(ids), () =>
      cliente.from('v_goles').select('*').in('partido_id', lista(ids)).order('orden').order('gol_id')),

    incidenciasDe: (ids) => consultar('incidencias:' + lista(ids), () =>
      cliente.from('v_incidencias').select('*').in('partido_id', lista(ids)).order('orden').order('id')),

    formacionesDe: (ids) => consultar('formaciones:' + lista(ids), () =>
      cliente.from('v_formaciones').select('*').in('partido_id', lista(ids)).order('nro_lista')),

    posicionesDe: (torneoId) => consultar('posiciones:' + torneoId, () =>
      cliente.from('posiciones').select('categoria,tras_fecha,posicion,pts').eq('torneo_id', torneoId).order('id')),

    fuentes: (ids) => consultar('fuentes:' + lista(ids), () =>
      cliente.from('fuentes').select('fuente_id,medio,que_cubre,url').in('fuente_id', lista(ids)).order('fuente_id')),

    // ---------- Modo administrador ----------
    // Sin caché: siempre lo último de la base.
    olvidarCache,
    sesion: async () => (cliente ? (await cliente.auth.getSession()).data.session : null),
    ingresar: async (email, clave) => {
      const { error } = await cliente.auth.signInWithPassword({ email, password: clave });
      olvidarCache();
      if (error) throw error;
    },
    salir: async () => {
      await cliente.auth.signOut({ scope: 'local' });
      olvidarCache();
    },
    administrador: async () => {
      const { data, error } = await cliente.from('administradores').select('nombre').limit(1);
      if (error) throw error;
      return data[0] || null;
    },
    admin: {
      partidos: () => todas(() => cliente.from('v_partidos')
        .select(COLUMNAS_PARTIDO + ',publicado,actualizado_en').order('partido_id')),
      equipos: () => todas(() => cliente.from('equipos').select('equipo_id,nombre_corto,cancha,es_propio').order('nombre_corto')),
      torneos: () => todas(() => cliente.from('torneos').select('torneo_id,anio,nombre,tipo,orden').order('orden', { ascending: false })),
      jugadores: () => todas(() => cliente.from('jugadores').select('jugador_id,apellido,nombre,division').order('apellido').order('nombre')),
      // Quién jugó (goles o formación) por categoría y año, para ordenar la lista de jugadores
      goleadoresRecientes: () => todas(() => cliente.from('v_goleadores').select('jugador_id,categoria,anio,goles')),
      golesDe: (ids) => todas(() => cliente.from('v_goles').select('*').in('partido_id', ids).order('orden').order('gol_id')),
      incidenciasDe: (ids) => todas(() => cliente.from('v_incidencias').select('*').in('partido_id', ids).order('orden').order('id')),
      // Nombres ya usados para los goleadores de un equipo rival (sugerencias)
      nombresRival: (equipoId) => todas(() => cliente.from('goles').select('nombre_en_fuente')
        .eq('equipo_id', equipoId).not('nombre_en_fuente', 'is', null)),
      fuentesDe: (ids) => (ids.length ? todas(() => cliente.from('fuentes').select('fuente_id,url').in('fuente_id', ids)) : Promise.resolve([])),
      faltantes: () => todas(() => cliente.from('v_faltantes').select('*')).then((f) => f[0] || {}),
      cambios: async () => {
        const { data, error } = await cliente.from('v_cambios').select('*').order('fecha', { ascending: false }).limit(10)
          .abortSignal(AbortSignal.timeout(ESPERA_MS));
        if (error) throw error;
        return data;
      },
      guardarPartido: (payload) => llamar('guardar_partido', { payload }),
      crearJugador: (apellido, nombre, division) =>
        llamar('crear_jugador', { p_apellido: apellido, p_nombre: nombre || null, p_division: division || null }),
      borrarBorrador: (ids, prueba) => llamar('borrar_borrador', { p_partido_ids: ids, p_prueba: !!prueba })
    }
  };
})();
