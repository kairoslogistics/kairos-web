// La página pregunta por su orden al volver del pago. Con el número de orden y el mismo correo de la compra
// devuelve el estado y, si ya está pagada, el código. Así el cliente lo ve en pantalla aunque el correo tarde o falle.
import { leer } from '../lib/firestore.mjs';
import { json } from '../lib/comun.mjs';

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const id = String(q.get('orden') || '').replace(/[^A-Z0-9-]/gi, ''), correo = String(q.get('correo') || '').trim().toLowerCase();
  if (!id || !correo) return json({ error: 'Faltan datos' }, 400);
  try {
    const doc = await leer('ordenes/' + id);
    // Misma respuesta si la orden no existe o el correo no coincide, para no revelar órdenes ajenas.
    if (!doc || doc.datos.correo !== correo) return json({ estado: 'desconocida' }, 404);
    const o = doc.datos;
    if (o.estado === 'pagada' && o.codigo) return json({ estado: 'pagada', codigo: o.codigo, producto: o.producto });
    return json({ estado: { 'pago incompleto': 'incompleto', 'por verificar': 'verificando', rechazada: 'rechazada' }[o.estado] || 'pendiente' });
  } catch (e) {
    console.error(e);
    return json({ error: 'No pudimos revisar tu orden' }, 500);
  }
};

export const config = { path: '/api/orden' };
