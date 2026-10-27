// Tasas del día para la página: peso chileno, peso argentino, real y bolívar (BCV dólar y euro). Ver lib/tasas.mjs.
import { obtenerTasas } from '../lib/tasas.mjs';

export default async () => {
  const t = await obtenerTasas();
  return new Response(JSON.stringify(t), { headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } });
};

export const config = { path: '/api/tasas' };
