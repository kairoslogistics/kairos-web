// Tasas de cambio del día (Jesús, 25 oct. 2026): ya no se escriben a mano.
// - Peso chileno: dólar observado del Banco Central de Chile, vía mindicador.cl. Respaldo: open.er-api.com.
// - Bolívar: tasa oficial del BCV (dólar y euro), vía ve.dolarapi.com. Si no trae el euro, se calcula con el dólar BCV y el euro/dólar del día.
// - Real brasileño: open.er-api.com.
// - Peso argentino (Jesús, 27 oct. 2026, para el registro de gastos): dólar blue de dolarapi.com (compra); respaldo: open.er-api.com.
// Si una fuente falla se usa la última buena (memoria de la función) y, si no hay, el respaldo que pase quien llama.
const VIGENCIA = 30 * 60 * 1000;
let cache = null, cacheEn = 0;

async function leerJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
const num = v => (+v > 0 ? +v : null);
const ok = p => p.then(v => v, () => null);

export async function obtenerTasas() {
  if (cache && Date.now() - cacheEn < VIGENCIA) return cache;
  const [mi, er, vu, ve, ab] = await Promise.all([
    ok(leerJson('https://mindicador.cl/api/dolar')),
    ok(leerJson('https://open.er-api.com/v6/latest/USD')),
    ok(leerJson('https://ve.dolarapi.com/v1/dolares/oficial')),
    ok(leerJson('https://ve.dolarapi.com/v1/euros/oficial')),
    ok(leerJson('https://dolarapi.com/v1/dolares/blue')),
  ]);
  const R = er?.rates || {};
  const clp = num(mi?.serie?.[0]?.valor) || num(R.CLP);
  const bcvUsd = num(vu?.promedio) || num(vu?.venta);
  const eurUsd = num(R.EUR) ? 1 / R.EUR : null; // dólares por 1 euro
  const bcvEur = num(ve?.promedio) || num(ve?.venta) || (bcvUsd && eurUsd ? Math.round(bcvUsd * eurUsd * 100) / 100 : null);
  const nuevo = {
    clp: clp ? Math.round(clp * 100) / 100 : null,
    brl: num(R.BRL) ? Math.round(R.BRL * 100) / 100 : null,
    ars: num(ab?.compra) || num(ab?.venta) || (num(R.ARS) ? Math.round(R.ARS * 100) / 100 : null),
    bcv_usd: bcvUsd, bcv_eur: bcvEur,
    fecha_clp: mi?.serie?.[0]?.fecha || null, fecha_bcv: vu?.fechaActualizacion || null,
    fuentes: { clp: num(mi?.serie?.[0]?.valor) ? 'Banco Central de Chile (mindicador.cl)' : clp ? 'open.er-api.com' : null,
      bcv: bcvUsd ? 'BCV (ve.dolarapi.com)' : null },
  };
  // No pisar un valor bueno con uno vacío.
  if (cache) for (const k of ['clp', 'brl', 'ars', 'bcv_usd', 'bcv_eur']) if (nuevo[k] == null) nuevo[k] = cache[k];
  if (nuevo.clp || nuevo.bcv_usd) { cache = nuevo; cacheEn = Date.now(); }
  return nuevo;
}
