// El cliente vuelve de PayPal (flujo antiguo por redirección): aquí se cobra con la misma lógica que capture-order
// y se lo manda de vuelta a la página, que muestra el código en pantalla.
import { sitio } from '../lib/comun.mjs';
import { cobrarPayPal } from '../lib/cobro-paypal.mjs';

const ir = q => Response.redirect(sitio() + '/?' + q + '#vehiculo', 302);

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const id = String(q.get('orden') || '').replace(/[^A-Z0-9-]/gi, ''), pedido = String(q.get('token') || '');
  try {
    const c = await cobrarPayPal(id, pedido);
    if (c.resultado === 'invalida' || c.resultado === 'rechazada') return ir('pago=cancelado');
    return ir('pago=ok&orden=' + id);
  } catch (e) {
    console.error('paypal-volver', e.message);
    return ir('pago=ok&orden=' + id);
  }
};

export const config = { path: '/api/paypal-volver' };
