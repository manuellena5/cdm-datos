// Todas las llamadas a Supabase pasan por acá.
window.CDM = window.CDM || {};

CDM.api = (function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = CDM.config;
  const configurada = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  let cliente = null;
  if (configurada && window.supabase) {
    cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

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

  return { cliente, configurada, probarConexion };
})();
