// Agenda de la asesoría 1 a 1 (Elise, 2 nov. 2026). Página: /agendar/. Panel: /admin/agenda/.
// GET  /api/agenda → horarios de las próximas semanas [{ inicio, libre }] (sin datos de nadie).
// POST /api/agenda → el cliente pide una hora: se guarda en citas/{id} como «pendiente» y se avisa a Kairos.
//      No bloquea la hora: se bloquea cuando Elise confirma el pago en el panel (publico/agenda.ocupadas).
import { leer, crear, cambiar } from '../lib/firestore.mjs';
import { json, texto, correoValido, azar, PAISES } from '../lib/comun.mjs';
import { enviar } from '../lib/correo.mjs';
import { horarios, AGENDA } from '../lib/agenda.mjs';
import { correoNuevaCita, correoSolicitud, whatsNuevaCita } from '../lib/citas.mjs';
import { avisoWhatsApp } from '../lib/whatsapp.mjs';

async function ocupadas() {
  const a = (await leer('publico/agenda'))?.datos || {};
  return [...(a.ocupadas || []), ...(a.bloqueos || [])].filter(o => o && +o.inicio && +o.fin);
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ horarios: horarios(await ocupadas()), duracion: AGENDA.duracion, zona: AGENDA.zona }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (req.method !== 'POST') return json({ error: 'Usa GET o POST' }, 405);
    let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
    if (texto(d.web)) return json({ id: 'ok' }); // campo trampa para robots
    const nombre = texto(d.nombre), correo = texto(d.correo, 160).toLowerCase(), whatsapp = texto(d.whatsapp, 30), pais = texto(d.pais, 40);
    if (nombre.split(/\s+/).length < 2) return json({ error: 'Escribe tu nombre y apellido.' }, 400);
    if (!correoValido(correo)) return json({ error: 'Revisa tu correo.' }, 400);
    if (!/^\+?\d[\d\s-]{6,}$/.test(whatsapp)) return json({ error: 'Escribe tu WhatsApp con el código de país, por ejemplo +56 9 1234 5678.' }, 400);
    if (!PAISES.includes(pais)) return json({ error: 'Elige el país donde vives.' }, 400);
    const inicio = +d.inicio, h = horarios(await ocupadas()).find(x => x.inicio === inicio);
    if (!h || !h.libre) return json({ error: 'Esa hora ya no está disponible. Elige otra.', ocupada: true }, 409);
    let zona = texto(d.zona, 60); try { new Intl.DateTimeFormat('es', { timeZone: zona }); } catch { zona = ''; }
    const id = 'C-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + azar(4);
    const cita = { id, estado: 'pendiente', inicio, fin: inicio + AGENDA.duracion * 60000, nombre, correo, whatsapp: whatsapp.startsWith('+') ? whatsapp : '+' + whatsapp,
      pais, zona, vehiculo: texto(d.vehiculo, 200), notas: texto(d.notas, 600), creada: new Date(), created_at: Date.now() };
    if (!await crear('citas/' + id, cita)) return json({ error: 'Inténtalo de nuevo.' }, 409);
    // Avisos. Si alguno falla, la solicitud igual queda en el panel.
    const avisos = await Promise.allSettled([enviar(correoNuevaCita(cita)), avisoWhatsApp(whatsNuevaCita(cita)), enviar(correoSolicitud(cita))]);
    avisos.forEach((r, i) => r.status === 'rejected' && console.error('aviso cita', i, r.reason?.message));
    await cambiar('citas/' + id, { aviso_correo: avisos[0].status === 'fulfilled', aviso_whatsapp: avisos[1].status === 'fulfilled' && avisos[1].value === true }).catch(() => {});
    return json({ id, inicio });
  } catch (e) {
    console.error(e);
    return json({ error: 'No pudimos guardar tu solicitud. Escríbenos por WhatsApp.' }, 500);
  }
};

export const config = { path: '/api/agenda' };
