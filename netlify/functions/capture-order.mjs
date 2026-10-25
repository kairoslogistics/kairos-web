// Botones de PayPal: cuando el cliente aprueba, la página manda { orderID, orden }. Aquí se cobra y se devuelve el estado,
// el ID de la transacción y, si quedó pagada, el código de acceso.
import { json } from '../lib/comun.mjs';
import { paypalActivo } from '../lib/paypal.mjs';
import { cobrarPayPal } from '../lib/cobro-paypal.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  if (!paypalActivo()) return json({ error: 'El pago con PayPal no está disponible ahora.' }, 503);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const pedido = String(d?.orderID || '').replace(/[^A-Z0-9]/gi, ''), id = String(d?.orden || '').replace(/[^A-Z0-9-]/gi, '');
  if (!pedido || !id) return json({ error: 'Faltan datos del pago.' }, 400);
  try {
    const c = await cobrarPayPal(id, pedido);
    switch (c.resultado) {
      case 'pagada': return json({ estado: 'COMPLETED', transaccion: c.captura, orden: id, codigo: c.codigo });
      case 'revisar': return json({ estado: 'REVISAR', transaccion: c.captura, orden: id });
      case 'pendiente': return json({ estado: 'PENDING', transaccion: c.captura, orden: id });
      case 'invalida': return json({ error: 'No encontramos esta orden. Escríbenos por WhatsApp.' }, 404);
      default:
        // INSTRUMENT_DECLINED: la tarjeta o el medio fue rechazado; la página puede ofrecer pagar con otro.
        if (c.problema === 'INSTRUMENT_DECLINED') return json({ error: 'Tu banco o PayPal rechazó el pago. Prueba con otra tarjeta o cuenta.', reintentar: true }, 422);
        return json({ error: 'El pago no se completó y no se te cobró nada. Inténtalo de nuevo.', detalle: c.problema || c.estado }, 402);
    }
  } catch (e) {
    console.error('capture-order', e.message);
    return json({ error: 'No pudimos confirmar tu pago. Si se te cobró, escríbenos por WhatsApp con tu número de orden ' + id + '.' }, 500);
  }
};

export const config = { path: '/api/capture-order' };
