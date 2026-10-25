// Devuelve solo el Client ID de PayPal (es público) para que la página cargue el SDK. El SECRET nunca sale del servidor.
import { json } from '../lib/comun.mjs';

export default async () => {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!clientId || !process.env.PAYPAL_SECRET) return json({ error: 'El pago con PayPal no está disponible ahora.' }, 503);
    return new Response(JSON.stringify({ clientId }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    console.error('paypal-config', e.message);
    return json({ error: 'No pudimos cargar PayPal.' }, 500);
  }
};

export const config = { path: '/api/paypal-config' };
