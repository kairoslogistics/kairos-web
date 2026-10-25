// PayPal (Elise, 25 oct. 2026): cuenta de persona; el cliente paga en USD con tarjeta o con su PayPal.
// Claves en Netlify: PAYPAL_CLIENT_ID y PAYPAL_SECRET (de una app «Live» en developer.paypal.com). PAYPAL_SANDBOX=si para pruebas.
const BASE = () => process.env.PAYPAL_SANDBOX === 'si' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
export const paypalActivo = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);

async function token() {
  const r = await fetch(BASE() + '/v1/oauth2/token', {
    method: 'POST', body: 'grant_type=client_credentials',
    headers: { Authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('PayPal token ' + r.status);
  return j.access_token;
}
async function api(ruta, cuerpo) {
  const r = await fetch(BASE() + ruta, { method: cuerpo === undefined ? 'GET' : 'POST', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' } });
  return { r, j: await r.json().catch(() => ({})) };
}

// Crea el pedido y devuelve { id, url } para mandar al cliente a pagar.
export async function crearPedido({ id, monto, descripcion, volver, cancelar }) {
  const { r, j } = await api('/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{ reference_id: id, custom_id: id, description: descripcion.slice(0, 120), amount: { currency_code: 'USD', value: Number(monto).toFixed(2) } }],
    payment_source: { paypal: { experience_context: { brand_name: 'Kairos Logistics', locale: 'es-XC', landing_page: 'GUEST_CHECKOUT', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: volver, cancel_url: cancelar } } },
  });
  const url = (j.links || []).find(l => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  if (!r.ok || !j.id || !url) throw new Error('PayPal crear ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
  return { id: j.id, url };
}

// Cobra el pedido que el cliente aprobó. Devuelve { pagado, monto, moneda, captura, estado }.
export async function capturar(pedido) {
  let { r, j } = await api('/v2/checkout/orders/' + encodeURIComponent(pedido) + '/capture', {});
  if (!r.ok && (j.details || []).some(d => d.issue === 'ORDER_ALREADY_CAPTURED')) ({ r, j } = await api('/v2/checkout/orders/' + encodeURIComponent(pedido)));
  const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
  return { pagado: j.status === 'COMPLETED' && cap?.status === 'COMPLETED', monto: Number(cap?.amount?.value), moneda: cap?.amount?.currency_code, captura: cap?.id || '', estado: cap?.status || j.status || String(r.status) };
}
