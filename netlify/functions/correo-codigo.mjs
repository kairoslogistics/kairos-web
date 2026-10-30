// Pago Móvil (Elise, 30 oct. 2026): cuando Kairos aprueba el pago en el panel, el panel llama aquí y se envía al cliente
// el mismo correo de los otros pagos (código y video de cómo usarlo). Solo si la orden ya está pagada y una sola vez:
// el correo va siempre a la dirección de la orden, así que nadie puede mandarlo a otra parte.
import { leer } from '../lib/firestore.mjs';
import { json, texto } from '../lib/comun.mjs';
import { completar } from '../lib/ordenes.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const id = texto(d.orden, 40).replace(/[^A-Z0-9-]/gi, ''), ruta = 'ordenes/' + id;
  try {
    const o = id && (await leer(ruta))?.datos;
    if (!o || o.estado !== 'pagada' || !o.codigo) return json({ error: 'La orden no está pagada.' }, 404);
    if (o.correo_cliente) return json({ ok: true, ya: true });
    await completar(ruta, o.metodo === 'pagomovil' ? 'Pago Móvil' : 'Panel');
    return json({ ok: true });
  } catch (e) {
    console.error('correo-codigo', e.message);
    return json({ error: 'No se pudo enviar el correo.' }, 500);
  }
};

export const config = { path: '/api/correo-codigo' };
