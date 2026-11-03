// Recordatorio de la asesoría 1 a 1 (Elise, 2 nov. 2026). Corre cada 30 minutos (función programada de Netlify).
// A las citas confirmadas (pagadas) que empiezan dentro de las próximas 3 horas les manda, una sola vez:
// correo + WhatsApp a Kairos y correo al cliente.
import { leer, cambiar } from '../lib/firestore.mjs';
import { enviar } from '../lib/correo.mjs';
import { avisoWhatsApp } from '../lib/whatsapp.mjs';
import { correoRecordatorioKairos, correoRecordatorioCliente, whatsRecordatorio } from '../lib/citas.mjs';

export const ANTES = 3 * 3600000;

export default async () => {
  const ahora = Date.now(), a = (await leer('publico/agenda'))?.datos || {};
  const proximas = (a.ocupadas || []).filter(o => o.id && +o.inicio > ahora && +o.inicio - ahora <= ANTES);
  for (const o of proximas) {
    try {
      const doc = await leer('citas/' + o.id); if (!doc) continue;
      const c = doc.datos;
      if (c.estado !== 'confirmada' || c.recordada) continue;
      // Marca primero (con la versión leída) para no mandar dos veces si se cruzan dos ejecuciones.
      if (!await cambiar('citas/' + o.id, { recordada: true }, doc.actualizado)) continue;
      const r = await Promise.allSettled([enviar(correoRecordatorioKairos(c)), avisoWhatsApp(whatsRecordatorio(c)), enviar(correoRecordatorioCliente(c))]);
      r.forEach((x, i) => x.status === 'rejected' && console.error('recordatorio', o.id, i, x.reason?.message));
    } catch (e) { console.error('recordatorio', o.id, e.message); }
  }
  return new Response('ok');
};

export const config = { schedule: '*/30 * * * *' };
