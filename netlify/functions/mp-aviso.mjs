// Aviso de Mercado Pago cuando cambia un pago. Se consulta el pago en Mercado Pago, se compara con la orden y, si está aprobado, se crea el código y se envían los correos.
import { leer, cambiar } from '../lib/firestore.mjs';
import { json } from '../lib/comun.mjs';
import { leerPago } from '../lib/mercadopago.mjs';
import { marcarPagada, completar } from '../lib/ordenes.mjs';
import { enviar, correoAviso } from '../lib/correo.mjs';

export default async (req) => {
  const q = new URL(req.url).searchParams;
  let b = {}; try { b = await req.json(); } catch {}
  const tipo = b.type || b.topic || q.get('type') || q.get('topic');
  const pagoId = String(b.data?.id || q.get('data.id') || (tipo === 'payment' ? q.get('id') : '') || '').replace(/[^0-9]/g, '');
  if (tipo !== 'payment' || !pagoId) return json({ ok: true });
  try {
    const p = await leerPago(pagoId);
    const id = p.orden.replace(/[^A-Z0-9-]/gi, ''), ruta = 'ordenes/' + id;
    const doc = id && await leer(ruta);
    if (!doc || doc.datos.metodo !== 'mercadopago') return json({ ok: true });
    if (p.estado !== 'approved') { if (doc.datos.estado !== 'pagada') await cambiar(ruta, { pago_estado: p.estado, pago_id: p.id }); return json({ ok: true }); }
    if (doc.datos.estado !== 'pagada') {
      if (p.moneda !== 'CLP' || p.monto !== Number(doc.datos.monto_clp)) {
        await cambiar(ruta, { estado: 'revisar', pago_estado: p.estado, pago_id: p.id });
        try { await enviar(correoAviso(doc.datos, 'Pago Mercado Pago para revisar (el monto no coincide)')); } catch (e) { console.error('aviso', e.message); }
        return json({ ok: true });
      }
      await marcarPagada(ruta, doc, { pago_estado: 'approved', pago_id: p.id, pagado_con: 'Mercado Pago' });
    }
    await completar(ruta, 'Mercado Pago');
  } catch (e) {
    console.error('mp-aviso', e.message);
    return json({ error: 'reintentar' }, 500); // Mercado Pago vuelve a avisar
  }
  return json({ ok: true });
};

export const config = { path: '/api/mp-aviso' };
