// Botones de PayPal: la página manda los datos del cliente y el servicio elegido. El monto sale de PRODUCTOS (servidor),
// nunca del navegador. Se guarda la orden en Firestore y se crea el pedido en PayPal; vuelve { id, orden }.
import { crear, cambiar } from '../lib/firestore.mjs';
import { nuevaOrden, json, validarCliente } from '../lib/comun.mjs';
import { crearPedidoBotones, paypalActivo } from '../lib/paypal.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  if (!paypalActivo()) return json({ error: 'El pago con PayPal no está disponible ahora. Elige otra forma de pago.' }, 503);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const v = validarCliente(d || {});
  if (v.error) return json({ error: v.error }, 400);
  const { p, nombre, correo, whatsapp, pais, sim } = v;

  const id = nuevaOrden();
  try {
    if (!await crear('ordenes/' + id, { id, estado: 'pendiente', metodo: 'paypal', producto: d.producto, monto: p.precio, nombre, correo, whatsapp, pais, sim, creada: new Date(), created_at: Date.now() }))
      return json({ error: 'Inténtalo de nuevo.' }, 409);
    try {
      const pp = await crearPedidoBotones({ id, monto: p.precio, descripcion: p.nombre + ' · Kairos Logistics' });
      await cambiar('ordenes/' + id, { paypal_id: pp.id });
      return json({ id: pp.id, orden: id });
    } catch (e) {
      console.error('create-order', e.message);
      await cambiar('ordenes/' + id, { estado: 'error al crear pago' });
      return json({ error: 'No pudimos abrir PayPal. Inténtalo de nuevo o escríbenos por WhatsApp.' }, 502);
    }
  } catch (e) {
    console.error('create-order', e.message);
    return json({ error: 'No pudimos abrir el pago. Inténtalo de nuevo o escríbenos por WhatsApp.' }, 500);
  }
};

export const config = { path: '/api/create-order' };
