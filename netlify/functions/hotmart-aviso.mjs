// Aviso (webhook 2.0) de Hotmart. Se revisa el hottok; con la compra aprobada se crea el código y se envían los correos.
import { timingSafeEqual } from 'node:crypto';
import { leer, cambiar } from '../lib/firestore.mjs';
import { json } from '../lib/comun.mjs';
import { marcarPagada, completar } from '../lib/ordenes.mjs';

const igual = (a, b) => { a = Buffer.from(String(a || '')); b = Buffer.from(String(b || '')); return a.length === b.length && a.length > 0 && timingSafeEqual(a, b); };

export default async (req) => {
  if (!igual(req.headers.get('x-hotmart-hottok'), process.env.HOTMART_HOTTOK)) return json({ error: 'no autorizado' }, 401);
  let b = {}; try { b = await req.json(); } catch { return json({ ok: true }); }
  const compra = b.data?.purchase || {}, evento = b.event || '';
  const id = String(compra.origin?.xcod || '').replace(/[^A-Z0-9-]/gi, ''), ruta = 'ordenes/' + id;
  try {
    const doc = id && await leer(ruta);
    if (!doc || doc.datos.metodo !== 'hotmart') return json({ ok: true });
    const aprobada = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'].includes(evento) && ['APPROVED', 'COMPLETE', 'COMPLETED'].includes(compra.status);
    if (!aprobada) { if (doc.datos.estado !== 'pagada') await cambiar(ruta, { pago_estado: evento + ' ' + (compra.status || ''), pago_id: String(compra.transaction || '') }); return json({ ok: true }); }
    await marcarPagada(ruta, doc, { pago_estado: compra.status, pago_id: String(compra.transaction || ''), pagado_con: 'Hotmart' });
    await completar(ruta, 'Hotmart');
  } catch (e) {
    console.error('hotmart-aviso', e.message);
    return json({ error: 'reintentar' }, 500); // Hotmart vuelve a avisar
  }
  return json({ ok: true });
};

export const config = { path: '/api/hotmart-aviso' };
