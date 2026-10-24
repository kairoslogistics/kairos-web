// La página manda los datos del cliente y de su simulación; aquí se guarda la orden y se crea la factura en NOWPayments.
// A la página solo vuelve el enlace de pago.
import { crear, cambiar } from '../lib/firestore.mjs';
import { nuevaOrden, json, sitio, validarCliente } from '../lib/comun.mjs';

const API = () => process.env.NOWPAYMENTS_SANDBOX === 'si' ? 'https://api-sandbox.nowpayments.io/v1/' : 'https://api.nowpayments.io/v1/';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const v = validarCliente(d);
  if (v.error) return json({ error: v.error }, 400);
  const { p, nombre, correo, whatsapp, pais, sim } = v;

  const id = nuevaOrden();
  const orden = { id, estado: 'pendiente', producto: d.producto, monto: p.precio, nombre, correo, whatsapp, pais, sim, creada: new Date(), created_at: Date.now() };
  try {
    if (!await crear('ordenes/' + id, orden)) return json({ error: 'Inténtalo de nuevo.' }, 409);
    const r = await fetch(API() + 'invoice', {
      method: 'POST', headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: p.precio, price_currency: 'usd', order_id: id, order_description: p.nombre + ' · Kairos Logistics',
        ipn_callback_url: sitio() + '/api/nowpayments-ipn',
        success_url: sitio() + '/?pago=ok&orden=' + id + '#vehiculo', cancel_url: sitio() + '/?pago=cancelado#vehiculo',
      }),
    });
    const f = await r.json().catch(() => ({}));
    if (!r.ok || !f.invoice_url) { console.error('NOWPayments', r.status, JSON.stringify(f)); await cambiar('ordenes/' + id, { estado: 'error al crear pago' }); return json({ error: 'No pudimos abrir el pago. Inténtalo de nuevo o escríbenos por WhatsApp.' }, 502); }
    await cambiar('ordenes/' + id, { factura_id: String(f.id || '') });
    return json({ url: f.invoice_url, orden: id });
  } catch (e) {
    console.error(e);
    return json({ error: 'No pudimos abrir el pago. Inténtalo de nuevo o escríbenos por WhatsApp.' }, 500);
  }
};

export const config = { path: '/api/crear-orden' };
