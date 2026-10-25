// El cliente vuelve de PayPal con su pedido aprobado: aquí se cobra, se marca la orden pagada, se crea el código
// y se lo manda de vuelta a la página, que muestra el código en pantalla.
import { leer, cambiar } from '../lib/firestore.mjs';
import { sitio } from '../lib/comun.mjs';
import { capturar } from '../lib/paypal.mjs';
import { marcarPagada, completar } from '../lib/ordenes.mjs';
import { enviar, correoAviso } from '../lib/correo.mjs';

const ir = q => Response.redirect(sitio() + '/?' + q + '#vehiculo', 302);

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const id = String(q.get('orden') || '').replace(/[^A-Z0-9-]/gi, ''), pedido = String(q.get('token') || '');
  const ruta = 'ordenes/' + id;
  try {
    let doc = id && await leer(ruta);
    if (!doc || !pedido || doc.datos.paypal_id !== pedido) return ir('pago=cancelado');
    if (doc.datos.estado !== 'pagada') {
      const c = await capturar(pedido);
      if (!c.pagado) { await cambiar(ruta, { pago_estado: c.estado }); return ir('pago=cancelado'); }
      if (c.monto !== Number(doc.datos.monto) || c.moneda !== 'USD') {
        await cambiar(ruta, { estado: 'revisar', pago_estado: c.estado, pago_id: c.captura });
        try { await enviar(correoAviso(doc.datos, 'Pago PayPal para revisar (el monto no coincide)')); } catch (e) { console.error(e.message); }
        return ir('pago=ok&orden=' + id);
      }
      await marcarPagada(ruta, doc, { pago_estado: 'COMPLETED', pago_id: c.captura, pagado_con: 'PayPal' });
    }
    // Si el correo falla (sin Zoho Mail Lite), el código igual aparece en la página.
    try { await completar(ruta, 'PayPal'); } catch (e) { console.error('completar', e.message); }
    return ir('pago=ok&orden=' + id);
  } catch (e) {
    console.error(e);
    return ir('pago=ok&orden=' + id);
  }
};

export const config = { path: '/api/paypal-volver' };
