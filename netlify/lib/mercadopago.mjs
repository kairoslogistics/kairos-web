// Mercado Pago Checkout Pro (Jesús, 25 oct. 2026): para clientes en Chile, en pesos chilenos. El dinero queda en la cuenta Mercado Pago.
// Claves en Netlify: MP_ACCESS_TOKEN (credencial de producción de una aplicación en mercadopago.cl/developers) El peso se calcula con el dólar del día (lib/tasas.mjs); MP_TASA_CLP solo es respaldo si la fuente falla (por defecto 950).
import { obtenerTasas } from './tasas.mjs';
const API = 'https://api.mercadopago.com';
export const mpActivo = () => !!process.env.MP_ACCESS_TOKEN;
export const tasaClp = async () => (await obtenerTasas()).clp || (+process.env.MP_TASA_CLP > 0 ? +process.env.MP_TASA_CLP : 950);
// Precio en pesos, redondeado a la centena.
export const montoClp = async usd => Math.round(usd * await tasaClp() / 100) * 100;

async function api(ruta, cuerpo) {
  const r = await fetch(API + ruta, { method: cuerpo === undefined ? 'GET' : 'POST', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' } });
  return { r, j: await r.json().catch(() => ({})) };
}

// Crea la preferencia de pago y devuelve { id, url } para mandar al cliente a pagar.
export async function crearPreferencia({ id, clp, descripcion, correo, aviso, ok, fallo }) {
  const { r, j } = await api('/checkout/preferences', {
    items: [{ id, title: descripcion.slice(0, 120), quantity: 1, currency_id: 'CLP', unit_price: clp }],
    external_reference: id, notification_url: aviso, statement_descriptor: 'KAIROS LOGISTICS',
    payer: { email: correo }, back_urls: { success: ok, pending: ok, failure: fallo }, auto_return: 'approved',
  });
  if (!r.ok || !j.id || !j.init_point) throw new Error('Mercado Pago crear ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
  return { id: j.id, url: j.init_point };
}

// Lee un pago desde Mercado Pago (nunca se confía en lo que trae el aviso).
export async function leerPago(pagoId) {
  const { r, j } = await api('/v1/payments/' + encodeURIComponent(pagoId));
  if (!r.ok) throw new Error('Mercado Pago pago ' + r.status);
  return { estado: j.status, orden: j.external_reference || '', monto: Number(j.transaction_amount), moneda: j.currency_id, id: String(j.id) };
}
