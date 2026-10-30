// Correos desde contacto@kairoslogistics.net por el SMTP de Zoho (contraseña de aplicación en ZOHO_SMTP_PASS).
import nodemailer from 'nodemailer';
import { esc, sitio, WHATSAPP, PRODUCTOS } from './comun.mjs';

let transporte = null;
export function enviar(msg) {
  // CORREO_PRUEBA=si: no envía nada, solo lo deja en el registro de la función (para probar sin Zoho).
  if (process.env.CORREO_PRUEBA === 'si') { console.log('CORREO (prueba)', msg.to, msg.subject); return Promise.resolve({ prueba: true }); }
  transporte ||= nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true,
    auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
  });
  return transporte.sendMail({ from: '"Kairos Logistics" <' + process.env.ZOHO_SMTP_USER + '>', ...msg });
}

const wa = 'https://wa.me/' + WHATSAPP.replace(/\D/g, '');
const marco = cuerpo => `<!doctype html><html lang="es"><body style="margin:0;background:#0E3B43;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0E3B43"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="font-size:20px;font-weight:bold;letter-spacing:2px;padding-bottom:4px">KAIROS <span style="color:#E0A526">LOGISTICS</span></td></tr>
<tr><td style="border-top:3px solid #E0A526;padding-top:20px;font-size:16px;line-height:1.5">${cuerpo}</td></tr>
<tr><td style="padding-top:24px;font-size:13px;color:#c9d8da">¿Dudas? Escríbenos por WhatsApp: <a href="${wa}" style="color:#E0A526">${WHATSAPP}</a></td></tr>
</table></td></tr></table></body></html>`;

// Al confirmarse el pago va el código y, según lo que compró, el video corto de cómo usarlo (Elise, 30 oct. 2026).
// Los enlaces de los videos se cargan en el panel (publico/videos); si aún no hay, el correo sale sin ese botón.
export function correoCodigo(o) {
  const p = PRODUCTOS[o.producto], cod = encodeURIComponent(o.codigo), v = o.videos || {};
  const plan = o.producto === 'plan', gastos = o.producto === 'gastos', conItin = plan || o.producto === 'asesoria';
  const enlace = sitio() + (gastos ? '/gastos/?codigo=' : plan ? '/?itinerario=' : '/?codigo=') + cod + (gastos ? '' : '#vehiculo'), itin = sitio() + '/?itinerario=' + cod + '#vehiculo';
  // Videos cortos por producto (Elise, 30 oct. 2026): cómo abrir el cálculo (asesoría y otro vehículo), cómo usar el itinerario y el registrador.
  const videos = [[!gastos && !plan, v.calculo, 'Mira cómo abrir tu cálculo'], [conItin, v.itinerario, 'Mira cómo usar tu itinerario'], [gastos, v.gastos, 'Mira cómo usar tu registrador']]
    .filter(([si, url]) => si && /^https:\/\//.test(url || '')).map(([, url, t]) => ({ url, t }));
  // Itinerario (Elise, 26 oct. 2026): página privada que se abre en el teléfono, en hasta 3 dispositivos, por 60 días.
  const notaItin = conItin ? `Tu itinerario se abre con este código en hasta ${o.dispositivos || 3} teléfonos o computadores.` : '';
  const boton = (url, t, claro) => `<p style="text-align:center;margin:14px 0"><a href="${esc(url)}" style="background:${claro ? '#ffffff' : '#E0A526'};color:#0E3B43;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block">${t}</a></p>`;
  return {
    to: o.correo, subject: (gastos ? 'Tu registrador de gastos' : plan ? 'Tu itinerario de viaje' : 'Tu código de acceso') + ' – Kairos Logistics',
    text: `Hola ${o.nombre}:\n\nRecibimos tu pago. Tu código de acceso es: ${o.codigo}\n\n${gastos ? 'Abre tu registrador' : plan ? 'Abre tu itinerario' : 'Úsalo'} aquí: ${enlace}\n${conItin && !plan ? 'Tu itinerario: ' + itin + '\n' : ''}${videos.map(x => x.t + ': ' + x.url + '\n').join('')}\nIncluye ${p.incluye}. Sirve por ${o.dias} días.${notaItin ? ' ' + notaItin : ''}\n\nOrden: ${o.id}\nMonto pagado: ${o.monto} USD\n\n¿Dudas? WhatsApp ${WHATSAPP}\n\nKairos Logistics`,
    html: marco(`<p>Hola ${esc(o.nombre)}:</p><p>Recibimos tu pago de <b>${esc(p.nombre)}</b>. Este es tu código de acceso:</p>
<p style="font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:6px;color:#0E3B43;background:#E0A526;padding:14px 18px;border-radius:8px;text-align:center;margin:18px 0">${esc(o.codigo)}</p>
${gastos ? boton(enlace, 'Abrir mi registrador de gastos', true) + '<p style="font-size:14px">Anota en el camino lo que gastas en combustible, comida, hospedaje y peajes. Funciona sin señal y te suma todo en dólares. Agrégalo a la pantalla de inicio de tu teléfono.</p>'
  : plan ? boton(enlace, 'Abrir mi itinerario', true) : boton(enlace, 'Ver mi detalle', true) + (conItin ? boton(itin, 'Abrir mi itinerario', true) : '')}
${videos.map(x => boton(x.url, '▶ ' + x.t)).join('')}
<p>Incluye ${esc(p.incluye)}. Tu código sirve por ${o.dias} días.${notaItin ? ' ' + esc(notaItin) : ''}</p>
<p style="font-size:14px;color:#c9d8da">Orden: ${esc(o.id)}<br>Monto pagado: ${esc(o.monto)} USD</p>`),
  };
}

export function correoIncompleto(o, pagado) {
  return {
    to: o.correo, subject: 'Tu pago llegó incompleto – Kairos Logistics',
    text: `Hola ${o.nombre}:\n\nTu pago de la orden ${o.id} llegó incompleto${pagado ? ` (recibimos ${pagado})` : ''}. Todavía no podemos enviarte tu código.\n\nEscríbenos por WhatsApp al ${WHATSAPP} y lo resolvemos.\n\nKairos Logistics`,
    html: marco(`<p>Hola ${esc(o.nombre)}:</p><p>Tu pago de la orden <b>${esc(o.id)}</b> llegó incompleto${pagado ? ` (recibimos ${esc(pagado)})` : ''}. Todavía no podemos enviarte tu código.</p>
<p style="text-align:center;margin:22px 0"><a href="${wa}" style="background:#E0A526;color:#0E3B43;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block">Escribir por WhatsApp</a></p>`),
  };
}

const filas = obj => Object.entries(obj || {}).map(([k, v]) => `<tr><td style="padding:3px 10px 3px 0;color:#c9d8da">${esc(k)}</td><td style="padding:3px 0">${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('');
export function correoAviso(o, titulo) {
  const cliente = { Nombre: o.nombre, Correo: o.correo, WhatsApp: o.whatsapp, País: o.pais, Producto: PRODUCTOS[o.producto]?.nombre, Monto: o.monto + ' USD', Orden: o.id, Código: o.codigo || '—' };
  return {
    to: process.env.AVISOS_A || process.env.ZOHO_SMTP_USER, replyTo: o.correo, subject: titulo + ': ' + o.nombre + ' · ' + o.monto + ' USD',
    text: titulo + '\n\n' + Object.entries(cliente).map(([k, v]) => k + ': ' + v).join('\n') + '\n\nSimulación:\n' + Object.entries(o.sim || {}).map(([k, v]) => k + ': ' + v).join('\n'),
    html: marco(`<p><b>${esc(titulo)}</b></p><table style="font-size:14px">${filas(cliente)}</table><p style="margin-top:16px"><b>Simulación</b></p><table style="font-size:14px">${filas(o.sim)}</table>`),
  };
}
