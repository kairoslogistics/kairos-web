// Lista de requisitos para quien compra la asesoría (Elise, 25 oct. 2026): por país de origen, vía (tierra o mar) y régimen
// (equipaje u ordinario). Elise la edita en el panel (pestaña Requisitos, Firestore requisitos/lista); si no hay, se usa la base.
import BASE from './requisitos-base.mjs'; // la arma preparar.py desde requisitos-base.json
import { leer } from './firestore.mjs';
import { esc, sitio, WHATSAPP } from './comun.mjs';

const base = () => BASE;
export const PAISES_REQ = { cl: 'Chile', ar: 'Argentina', br: 'Brasil', pa: 'Panamá', us: 'Estados Unidos' };
export const VIAS = { tierra: 'Por tierra', mar: 'Por barco' };
export const REGS = { equi: 'Régimen de equipaje', ord: 'Régimen ordinario' };
// Desde Panamá y Estados Unidos solo hay envío por barco.
export const soloMar = p => p === 'pa' || p === 'us';

export async function cargarLista() {
  try { const d = await leer('requisitos/lista'); const l = d?.datos?.json && JSON.parse(d.datos.json); if (l?.secciones?.length) return l; } catch (e) { console.error('requisitos', e.message); }
  return base();
}

// Lo que eligió el cliente en el simulador (datosSim de la página).
// Sin simulación se usa el país donde vive (formulario de pago).
const DE_NOMBRE = Object.fromEntries(Object.entries(PAISES_REQ).map(([k, v]) => [v, k]));
export function deSim(sim = {}, paisVive = '') {
  const p = String(sim.pais_origen || DE_NOMBRE[paisVive] || '').toLowerCase();
  const via = /mar/i.test(sim.Ruta || '') ? 'mar' : /terr/i.test(sim.Ruta || '') ? 'tierra' : '';
  const r = /equi/i.test(sim['Régimen'] || '') ? 'equi' : /ordin/i.test(sim['Régimen'] || '') ? 'ord' : '';
  return { p: PAISES_REQ[p] ? p : '', v: soloMar(p) ? 'mar' : via, r };
}

// Secciones con solo los requisitos que aplican. Si falta la vía o el régimen, entran todos y cada uno dice para cuál es.
export function filtrar(lista, { p = '', v = '', r = '' }) {
  if (soloMar(p)) v = 'mar';
  const pasa = (x, conP) => (!conP || !x.p?.length || !p || x.p.includes(p)) && (!x.v || !v || x.v === v) && (!x.r || !r || x.r === r);
  const etiqueta = x => [!v && x.v ? VIAS[x.v] : '', !r && x.r ? REGS[x.r] : ''].filter(Boolean).join(' · ');
  return (lista.secciones || []).filter(s => pasa(s, false)).map(s => ({
    titulo: s.titulo, solo: etiqueta(s),
    items: (s.items || []).filter(x => pasa(x, true) && (p || !x.p?.length)).map(x => ({ t: x.t, n: x.n || '', solo: etiqueta(x) })),
  })).filter(s => s.items.length);
}

export const tituloHoja = ({ p, v, r }) => ['Requisitos', p ? 'desde ' + PAISES_REQ[p] : '', v ? VIAS[v].toLowerCase() : '', r ? REGS[r].toLowerCase() : ''].filter(Boolean).join(' · ');

// Hoja para imprimir: una casilla a la izquierda de cada requisito.
export function hojaHtml(secs, sel, { nombre = '', enlaces = '' } = {}) {
  const filas = secs.map(s => `<h2>${esc(s.titulo)}${s.solo ? ` <small>(${esc(s.solo)})</small>` : ''}</h2><table>${s.items.map(x =>
    `<tr><td class="c"><span class="box"></span></td><td><b>${esc(x.t)}</b>${x.solo ? ` <small class="solo">(${esc(x.solo)})</small>` : ''}${x.n ? `<div class="n">${esc(x.n)}</div>` : ''}</td></tr>`).join('')}</table>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(tituloHoja(sel))} · Kairos Logistics</title>
<style>body{margin:0;background:#fff;color:#14262a;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4}.w{max-width:760px;margin:0 auto;padding:20px 16px 40px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:3px solid #E0A526;padding-bottom:10px}.marca{font-weight:bold;letter-spacing:2px;font-size:18px;color:#0E3B43}.marca span{color:#B9860F}
h1{font-size:20px;margin:16px 0 4px;color:#0E3B43}.sub{color:#4d6266;font-size:13px;margin:0 0 6px}h2{font-size:16px;margin:22px 0 6px;color:#0E3B43;border-bottom:1px solid #d7e0e1;padding-bottom:4px}h2 small{font-weight:normal;color:#4d6266}
table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:7px 6px;border-bottom:1px solid #eef2f2}td.c{width:30px;padding-left:0}.box{display:inline-block;width:20px;height:20px;border:2px solid #0E3B43;border-radius:3px;margin-top:1px}
.n{color:#4d6266;font-size:13px;margin-top:2px}.solo{color:#8a5d00}.pie{margin-top:24px;font-size:12px;color:#4d6266}.btn{background:#E0A526;color:#0E3B43;border:0;border-radius:8px;padding:10px 16px;font-weight:bold;font-size:15px;cursor:pointer}
.otras{font-size:13px;margin:10px 0 0}.otras a{color:#0E3B43;margin-right:10px}@media print{.np{display:none!important}.w{padding:0}body{font-size:13px}td{padding:5px 4px}}</style></head>
<body><div class="w"><div class="top"><div class="marca">KAIROS <span>LOGISTICS</span></div><button class="btn np" onclick="print()">Imprimir</button></div>
<h1>${esc(tituloHoja(sel))}</h1><p class="sub">${nombre ? 'Para ' + esc(nombre) + ' · ' : ''}Marca con una X cada documento cuando lo tengas listo.</p>${enlaces}${filas}
<p class="pie">Lista orientativa según la experiencia de Kairos Logistics. Los requisitos pueden cambiar: confírmalos con tu asesor antes de salir. Si te falta un documento, te ayudamos a conseguirlo. WhatsApp ${esc(WHATSAPP)} · ${esc(sitio().replace(/^https?:\/\//, ''))}</p></div></body></html>`;
}

// Versión para el cuerpo del correo (tabla simple, se ve bien en cualquier programa de correo).
export function listaCorreo(secs) {
  return secs.map(s => `<p style="margin:18px 0 6px;font-weight:bold;color:#E0A526">${esc(s.titulo)}${s.solo ? ` (${esc(s.solo)})` : ''}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">${s.items.map(x => `<tr><td style="width:26px;vertical-align:top;padding:4px 0;font-size:18px;line-height:1">&#9744;</td><td style="padding:4px 0">${esc(x.t)}${x.solo ? ` <span style="color:#c9d8da">(${esc(x.solo)})</span>` : ''}${x.n ? `<br><span style="color:#c9d8da;font-size:13px">${esc(x.n)}</span>` : ''}</td></tr>`).join('')}</table>`).join('');
}

export const listaTexto = secs => secs.map(s => s.titulo.toUpperCase() + (s.solo ? ` (${s.solo})` : '') + '\n' + s.items.map(x => '[ ] ' + x.t + (x.solo ? ` (${x.solo})` : '')).join('\n')).join('\n\n');
