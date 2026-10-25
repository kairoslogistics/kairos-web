// Pago Móvil (Venezuela). El cliente paga en bolívares a la tasa euro del BCV del día (lib/tasas.mjs; si la fuente falla, la que Elise carga en el panel)
// (Elise, 24 oct. 2026) y manda aquí su número de referencia. La orden queda «por verificar» hasta que Elise
// la aprueba en el panel; entonces la página, que sigue preguntando por la orden, muestra el código.
import { crear, leer, cambiar } from '../lib/firestore.mjs';
import { nuevaOrden, json, validarCliente, texto } from '../lib/comun.mjs';
import { enviar, correoAviso } from '../lib/correo.mjs';
import { obtenerTasas } from '../lib/tasas.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const v = validarCliente(d);
  if (v.error) return json({ error: v.error }, 400);
  const referencia = texto(d.referencia, 30).replace(/\s/g, ''), telefono = texto(d.telefono_pago, 30);
  if (!/^\d{4,20}$/.test(referencia)) return json({ error: 'Escribe el número de referencia del Pago Móvil (solo números).' }, 400);
  try {
    const cfg = (await leer('publico/pagomovil'))?.datos || {};
    const tasa = (await obtenerTasas()).bcv_eur || +cfg.tasa_euro;
    if (!(tasa > 0) || !cfg.telefono) return json({ error: 'El Pago Móvil no está disponible ahora. Escríbenos por WhatsApp.' }, 503);
    const id = nuevaOrden();
    const orden = { id, metodo: 'pagomovil', estado: 'por verificar', producto: d.producto, monto: v.p.precio, tasa_euro: tasa,
      monto_bs: Math.round(v.p.precio * tasa * 100) / 100, referencia, telefono_pago: telefono,
      nombre: v.nombre, correo: v.correo, whatsapp: v.whatsapp, pais: v.pais, sim: v.sim, creada: new Date(), created_at: Date.now() };
    if (!await crear('ordenes/' + id, orden)) return json({ error: 'Inténtalo de nuevo.' }, 409);
    // Aviso a Kairos. Si el correo falla (por ejemplo, sin Zoho Mail Lite) la orden igual aparece en el panel.
    try {
      const m = correoAviso({ ...orden, sim: { 'Pago Móvil': orden.monto_bs + ' Bs (tasa euro ' + tasa + ')', Referencia: referencia, 'Teléfono que pagó': telefono || '—', ...orden.sim } }, 'Pago Móvil por verificar');
      await enviar(m); await cambiar('ordenes/' + id, { correo_aviso: true });
    } catch (e) { console.error('aviso Pago Móvil', e.message); }
    return json({ orden: id, monto_bs: orden.monto_bs });
  } catch (e) {
    console.error(e);
    return json({ error: 'No pudimos registrar tu pago. Escríbenos por WhatsApp.' }, 500);
  }
};

export const config = { path: '/api/pago-movil' };
