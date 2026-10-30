// Abre el itinerario de viaje (Elise, 26 oct. 2026). Con un código de itinerario o de asesoría: vence a los 60 días y se abre
// en hasta 3 dispositivos. Cada apertura queda contada en el código para ver en el panel quién lo comparte.
import { leer, cambiar } from '../lib/firestore.mjs';
import { json, texto, MAX_DISPOSITIVOS, TIPOS_ITINERARIO } from '../lib/comun.mjs';

const ERR = {
  no: 'Ese código no existe o no es de un itinerario. Revisa que esté escrito igual que en tu correo.',
  anulado: 'Este código fue anulado porque la compra se canceló o se reembolsó.',
  vencido: 'Este código ya venció. Escríbenos por WhatsApp y te ayudamos.',
  dispositivos: `Este itinerario ya se abrió en ${MAX_DISPOSITIVOS} dispositivos, el máximo. Ábrelo en uno de ellos o escríbenos por WhatsApp.`,
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const codigo = texto(d.codigo, 40).toUpperCase().replace(/[^A-Z0-9-]/g, ''), disp = texto(d.dispositivo, 40).replace(/[^a-z0-9]/gi, '');
  if (!codigo || disp.length < 8) return json({ error: ERR.no, motivo: 'no' }, 400);
  try {
    for (let i = 0; i < 3; i++) {
      const doc = await leer('codigos/' + codigo), c = doc?.datos;
      if (!c || !TIPOS_ITINERARIO.includes(c.tipo)) return json({ error: ERR.no, motivo: 'no' }, 404);
      if (c.anulado) return json({ error: ERR.anulado, motivo: 'anulado' }, 410);
      if (c.vence && new Date(c.vence) < new Date()) return json({ error: ERR.vencido, motivo: 'vencido' }, 410);
      const lista = Array.isArray(c.dispositivos) ? c.dispositivos : [], ahora = Date.now();
      const ya = lista.find(x => x.id === disp);
      if (!ya && lista.length >= MAX_DISPOSITIVOS) {
        await cambiar('codigos/' + codigo, { rechazos: (+c.rechazos || 0) + 1, ultimo_rechazo: ahora }, doc.actualizado);
        return json({ error: ERR.dispositivos, motivo: 'dispositivos' }, 403);
      }
      const nueva = ya ? lista.map(x => x.id === disp ? { ...x, ultima: ahora, veces: (+x.veces || 0) + 1 } : x)
        : [...lista, { id: disp, equipo: texto(d.equipo, 60) || 'Dispositivo', primera: ahora, ultima: ahora, veces: 1 }];
      if (!await cambiar('codigos/' + codigo, { dispositivos: nueva, aperturas: (+c.aperturas || 0) + 1, ultima_apertura: ahora }, doc.actualizado)) continue;
      // Lo que eligió en el simulador, para armar el mismo itinerario en otro teléfono.
      let campos = c.sim?.campos || '';
      if (!campos && c.orden) campos = (await leer('ordenes/' + c.orden))?.datos?.sim?.campos || '';
      return json({ ok: true, tipo: c.tipo, campos, dispositivos: nueva.length, max: MAX_DISPOSITIVOS, vence: c.vence || null });
    }
    return json({ error: 'Inténtalo de nuevo.' }, 409);
  } catch (e) {
    console.error('itinerario', e.message);
    return json({ error: 'No pudimos revisar tu código. Revisa tu conexión e inténtalo de nuevo.', motivo: 'red' }, 500);
  }
};

export const config = { path: '/api/itinerario' };
