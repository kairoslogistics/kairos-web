// Correos y textos de la agenda de la asesoría 1 a 1 (ver lib/agenda.mjs).
import { esc, sitio, WHATSAPP } from './comun.mjs';
import { marco } from './correo.mjs';
import { fechaVE, fechaEn } from './agenda.mjs';

export const PRECIO_1A1 = 150;
const wa = 'https://wa.me/' + WHATSAPP.replace(/\D/g, '');
const filas = obj => Object.entries(obj).map(([k, v]) => `<tr><td style="padding:3px 10px 3px 0;color:#c9d8da;vertical-align:top">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join('');
const boton = (url, t) => `<p style="text-align:center;margin:18px 0"><a href="${esc(url)}" style="background:#E0A526;color:#0E3B43;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block">${t}</a></p>`;

export function datosCita(c) {
  const local = c.zona && c.zona !== 'America/Caracas' ? fechaEn(c.zona, c.inicio) : null;
  return {
    'Hora Venezuela': fechaVE(c.inicio), ...(local ? { ['Hora del cliente (' + c.zona + ')']: local } : {}),
    Nombre: c.nombre, Correo: c.correo, WhatsApp: c.whatsapp, 'País donde vive': c.pais,
    ...(c.vehiculo ? { 'Vehículo': c.vehiculo } : {}), ...(c.notas ? { 'Lo que quiere hablar': c.notas } : {}), Solicitud: c.id,
  };
}

// Aviso a Kairos cuando alguien pide una hora (todavía sin pagar).
export function correoNuevaCita(c) {
  const d = datosCita(c);
  return {
    to: process.env.AVISOS_A || process.env.ZOHO_SMTP_USER, replyTo: c.correo,
    subject: 'Asesoría 1 a 1 pedida: ' + c.nombre + ' · ' + fechaVE(c.inicio),
    text: 'Nueva solicitud de asesoría 1 a 1 (falta confirmar el pago de ' + PRECIO_1A1 + ' USD).\n\n' + Object.entries(d).map(([k, v]) => k + ': ' + v).join('\n') + '\n\nConfirma el pago en ' + sitio() + '/admin/agenda/',
    html: marco(`<p><b>Nueva solicitud de asesoría 1 a 1</b><br>La hora todavía no está reservada: se reserva cuando confirmes el pago de ${PRECIO_1A1} USD.</p><table style="font-size:14px">${filas(d)}</table>${boton(sitio() + '/admin/agenda/', 'Abrir la agenda')}`),
  };
}
export const whatsNuevaCita = c => `Kairos: asesoría 1 a 1 pedida\n${fechaVE(c.inicio)} (hora Venezuela)\n${c.nombre} · ${c.whatsapp} · ${c.pais}${c.vehiculo ? '\n' + c.vehiculo : ''}\nFalta confirmar el pago: ${sitio()}/admin/agenda/`;

// Al cliente: recibimos tu solicitud; la hora queda tuya cuando pagues.
export function correoSolicitud(c) {
  const local = (c.zona && fechaEn(c.zona, c.inicio)) || fechaVE(c.inicio) + ' (hora Venezuela)';
  const msg = wa + '?text=' + encodeURIComponent(`Hola, pedí la asesoría 1 a 1 para el ${fechaVE(c.inicio)} (hora Venezuela). Quiero pagar los ${PRECIO_1A1} USD. Solicitud ${c.id}`);
  return {
    to: c.correo, subject: 'Recibimos tu solicitud de asesoría 1 a 1 – Kairos Logistics',
    text: `Hola ${c.nombre}:\n\nRecibimos tu solicitud para la asesoría 1 a 1 en vivo:\n${local}\n\nTu hora queda reservada cuando confirmemos tu pago de ${PRECIO_1A1} USD. Escríbenos por WhatsApp para pagar: ${msg}\n\nKairos Logistics`,
    html: marco(`<p>Hola ${esc(c.nombre)}:</p><p>Recibimos tu solicitud para la <b>asesoría 1 a 1 en vivo</b>:</p><p style="font-size:20px;font-weight:bold;color:#E0A526">${esc(local)}</p><p>Tu hora queda reservada cuando confirmemos tu pago de <b>${PRECIO_1A1} USD</b>. Escríbenos por WhatsApp para pagar.</p>${boton(msg, 'Pagar por WhatsApp')}`),
  };
}

// Recordatorios unas horas antes (función programada recordar-citas).
export function correoRecordatorioKairos(c) {
  const d = datosCita(c);
  return {
    to: process.env.AVISOS_A || process.env.ZOHO_SMTP_USER, replyTo: c.correo, subject: 'Recordatorio: asesoría 1 a 1 con ' + c.nombre + ' · ' + fechaVE(c.inicio),
    text: 'Tienes una asesoría 1 a 1 pronto.\n\n' + Object.entries(d).map(([k, v]) => k + ': ' + v).join('\n'),
    html: marco(`<p><b>Recordatorio: asesoría 1 a 1 pronto</b></p><table style="font-size:14px">${filas(d)}</table>`),
  };
}
export const whatsRecordatorio = c => `Kairos: recordatorio asesoría 1 a 1\n${fechaVE(c.inicio)} (hora Venezuela)\n${c.nombre} · ${c.whatsapp}${c.vehiculo ? '\n' + c.vehiculo : ''}`;
export function correoRecordatorioCliente(c) {
  const local = (c.zona && fechaEn(c.zona, c.inicio)) || fechaVE(c.inicio) + ' (hora Venezuela)';
  return {
    to: c.correo, subject: 'Recordatorio: tu asesoría 1 a 1 con Kairos Logistics',
    text: `Hola ${c.nombre}:\n\nTe recordamos tu asesoría 1 a 1 en vivo: ${local}.\nTe escribiremos por WhatsApp con el enlace de la llamada.\n\nKairos Logistics`,
    html: marco(`<p>Hola ${esc(c.nombre)}:</p><p>Te recordamos tu <b>asesoría 1 a 1 en vivo</b>:</p><p style="font-size:20px;font-weight:bold;color:#E0A526">${esc(local)}</p><p>Te escribiremos por WhatsApp con el enlace de la llamada. Ten a mano los datos de tu vehículo.</p>`),
  };
}
