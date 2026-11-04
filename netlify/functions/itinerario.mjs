// Abre el itinerario de viaje (Elise, 26 oct. 2026). Con un código de itinerario o de asesoría: vence a los 60 días y se abre
// en hasta 2 dispositivos (4 nov. 2026). Cada apertura queda contada en el código para ver en el panel quién lo comparte.
import { leer, cambiar } from '../lib/firestore.mjs';
import { json, texto, MAX_DISPOSITIVOS, TIPOS_ITINERARIO, DIAS_ITINERARIO } from '../lib/comun.mjs';
import HOTELES from '../lib/hoteles.mjs';

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
      // Sin fecha de vencimiento (códigos antiguos): vence a los 60 días de creado o, si no se sabe, de la primera apertura (Elise, 4 nov. 2026).
      const lista0 = Array.isArray(c.dispositivos) ? c.dispositivos : [];
      const desde = +c.created_at || Math.min(...lista0.map(x => +x.primera || Infinity), Date.now());
      const vence = c.vence ? new Date(c.vence) : new Date(desde + DIAS_ITINERARIO * 864e5);
      if (vence < new Date()) return json({ error: ERR.vencido, motivo: 'vencido' }, 410);
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
      // Solo con un código válido van los hoteles y el nombre del dueño, que se muestra en el itinerario para que no se comparta.
      const nombre = texto(c.nombre || String(c.cliente || '').split(' · ')[0], 80);
      return json({ ok: true, tipo: c.tipo, campos, dispositivos: nueva.length, max: MAX_DISPOSITIVOS, vence, nombre, hoteles: HOTELES });
    }
    return json({ error: 'Inténtalo de nuevo.' }, 409);
  } catch (e) {
    console.error('itinerario', e.message);
    return json({ error: 'No pudimos revisar tu código. Revisa tu conexión e inténtalo de nuevo.', motivo: 'red' }, 500);
  }
};

export const config = { path: '/api/itinerario' };
