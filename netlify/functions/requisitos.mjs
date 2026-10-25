// Hoja de requisitos para imprimir (Elise, 25 oct. 2026). Solo con un código de asesoría: /api/requisitos?codigo=KAI-XXXXXX
// Por defecto muestra lo que el cliente eligió en el simulador; con p, v y r se cambia el país, la vía o el régimen.
import { leer } from '../lib/firestore.mjs';
import { esc } from '../lib/comun.mjs';
import { cargarLista, deSim, filtrar, hojaHtml, PAISES_REQ, VIAS, REGS, soloMar } from '../lib/requisitos.mjs';

const pagina = (html, status = 200) => new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
const aviso = t => pagina(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Requisitos · Kairos Logistics</title><body style="font-family:Arial,sans-serif;padding:24px;max-width:560px;margin:auto"><p>${t}</p></body>`, 404);

export default async (req) => {
  const q = new URL(req.url).searchParams, codigo = String(q.get('codigo') || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!codigo) return aviso('Falta tu código. Abre el enlace que te llegó por correo.');
  try {
    const c = await leer('codigos/' + codigo);
    if (!c || c.datos.tipo !== 'asesoria') return aviso('Este código no es de una asesoría. Escríbenos por WhatsApp y te enviamos tu lista.');
    const o = c.datos.orden ? (await leer('ordenes/' + c.datos.orden))?.datos || {} : {};
    const sel = deSim(o.sim || c.datos.sim || {}, o.pais);
    for (const [k, ok] of [['p', PAISES_REQ], ['v', VIAS], ['r', REGS]]) { const x = q.get(k); if (x !== null) sel[k] = ok[x] ? x : ''; }
    if (soloMar(sel.p)) sel.v = 'mar';
    const url = x => '?' + new URLSearchParams({ codigo, ...sel, ...x }).toString();
    const grupo = (k, ops) => ops.map(([v, t]) => sel[k] === v ? `<b>${esc(t)}</b>` : `<a href="${esc(url({ [k]: v }))}">${esc(t)}</a>`).join(' ');
    const enlaces = `<div class="np otras"><p>País: ${grupo('p', Object.entries(PAISES_REQ))}</p>${soloMar(sel.p) ? '' : `<p>Vía: ${grupo('v', [...Object.entries(VIAS), ['', 'Las dos']])}</p>`}<p>Régimen: ${grupo('r', [...Object.entries(REGS), ['', 'Los dos']])}</p></div>`;
    return pagina(hojaHtml(filtrar(await cargarLista(), sel), sel, { nombre: o.nombre, enlaces }));
  } catch (e) {
    console.error(e);
    return aviso('No pudimos abrir tu lista. Inténtalo de nuevo o escríbenos por WhatsApp.');
  }
};

export const config = { path: '/api/requisitos' };
