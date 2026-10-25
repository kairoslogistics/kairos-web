// Cobro de una orden de PayPal, igual para los botones de la página (capture-order) y para la vuelta por redirección (paypal-volver).
// Revisa que el pedido sea de esa orden, cobra, compara el monto con el precio guardado por el servidor y deja el código listo.
import { leer, cambiar } from './firestore.mjs';
import { capturar } from './paypal.mjs';
import { marcarPagada, completar } from './ordenes.mjs';
import { enviar, correoAviso } from './correo.mjs';

// Devuelve { resultado: 'pagada' | 'revisar' | 'pendiente' | 'rechazada' | 'invalida', captura, problema, codigo }.
export async function cobrarPayPal(id, pedido) {
  const ruta = 'ordenes/' + id;
  const doc = id && pedido && await leer(ruta);
  if (!doc || doc.datos.paypal_id !== pedido) return { resultado: 'invalida' };
  if (doc.datos.estado !== 'pagada') {
    const c = await capturar(pedido);
    if (!c.pagado) {
      await cambiar(ruta, { pago_estado: c.estado, ...(c.captura ? { pago_id: c.captura } : {}) });
      // PENDING: PayPal retuvo el pago para revisarlo; no se entrega el código hasta que se complete.
      return { resultado: c.estado === 'PENDING' ? 'pendiente' : 'rechazada', captura: c.captura, problema: c.problema };
    }
    if (c.monto !== Number(doc.datos.monto) || c.moneda !== 'USD') {
      await cambiar(ruta, { estado: 'revisar', pago_estado: c.estado, pago_id: c.captura });
      try { await enviar(correoAviso(doc.datos, 'Pago PayPal para revisar (el monto no coincide)')); } catch (e) { console.error('aviso', e.message); }
      return { resultado: 'revisar', captura: c.captura };
    }
    await marcarPagada(ruta, doc, { pago_estado: 'COMPLETED', pago_id: c.captura, pagado_con: 'PayPal' });
  }
  // Si el correo falla, el código igual se devuelve a la página.
  try { await completar(ruta, 'PayPal'); } catch (e) { console.error('completar', e.message); }
  const o = (await leer(ruta)).datos;
  return { resultado: 'pagada', captura: o.pago_id || '', codigo: o.codigo || '' };
}
