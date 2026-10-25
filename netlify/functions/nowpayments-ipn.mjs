// Aviso de NOWPayments (IPN). Se verifica la firma; con el pago completo se crea el código y salen los correos.
// Si el mismo aviso llega dos veces, no se crea otro código ni se repite un correo (cada paso queda marcado en la orden).
import { leer, cambiar } from '../lib/firestore.mjs';
import { firmaValida, json } from '../lib/comun.mjs';
import { enviar, correoIncompleto, correoAviso } from '../lib/correo.mjs';
import { marcarPagada, completar } from '../lib/ordenes.mjs';

const PAGADO = ['finished', 'confirmed'];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  const crudo = await req.text();
  let b; try { b = JSON.parse(crudo); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!firmaValida(b, req.headers.get('x-nowpayments-sig'), process.env.NOWPAYMENTS_IPN_SECRET)) return json({ error: 'Firma inválida' }, 401);

  const ruta = 'ordenes/' + String(b.order_id || '').replace(/[^A-Z0-9-]/gi, '');
  let doc = await leer(ruta);
  if (!doc) { console.warn('Aviso de una orden que no existe', b.order_id); return json({ ok: true }); }
  const o = doc.datos, estado = String(b.payment_status || '');
  const montoOk = Number(b.price_amount) === Number(o.monto) && String(b.price_currency || '').toLowerCase() === 'usd';

  if (PAGADO.includes(estado)) {
    if (o.estado === 'pagada') { await completar(ruta); return json({ ok: true, repetido: true }); }
    if (!montoOk) {
      if (o.estado !== 'revisar') { await cambiar(ruta, { estado: 'revisar', pago_estado: estado, pago: b }); await enviar(correoAviso(o, 'Pago para revisar (el monto no coincide)')); }
      return json({ ok: true, revisar: true });
    }
    await marcarPagada(ruta, doc, { pago_estado: estado, pago_id: String(b.payment_id || ''), pagado_con: String(b.pay_currency || '') });
    await completar(ruta);
    return json({ ok: true });
  }

  if (estado === 'partially_paid') {
    if (o.estado !== 'pagada' && !o.aviso_parcial) {
      await enviar(correoIncompleto(o, b.actually_paid ? b.actually_paid + ' ' + String(b.pay_currency || '').toUpperCase() : ''));
      await enviar(correoAviso(o, 'Pago incompleto'));
      await cambiar(ruta, { estado: 'pago incompleto', aviso_parcial: new Date(), pago_estado: estado });
    }
    return json({ ok: true });
  }

  // waiting, confirming, sending, failed, expired, refunded: solo se anota.
  if (o.estado !== 'pagada') await cambiar(ruta, { pago_estado: estado });
  return json({ ok: true });
};

export const config = { path: '/api/nowpayments-ipn' };
