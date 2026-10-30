// Lo que pasa cuando una orden queda pagada, igual para NOWPayments, Mercado Pago y Hotmart.
import { leer, crear, cambiar } from './firestore.mjs';
import { PRODUCTOS, USOS_CODIGO, nuevoCodigo, diasDe, MAX_DISPOSITIVOS } from './comun.mjs';
import { enviar, correoCodigo, correoAviso } from './correo.mjs';
import { cargarLista, deSim, filtrar, hojaHtml, listaCorreo, listaTexto, tituloHoja } from './requisitos.mjs';
import { sitio } from './comun.mjs';

// Marca la orden pagada con un código nuevo, solo si nadie la cambió desde que la leímos; si otro aviso ganó, ese ya creó el código.
export async function marcarPagada(ruta, doc, extra) {
  for (let i = 0; i < 3; i++) {
    if (doc.datos.estado === 'pagada') break;
    if (await cambiar(ruta, { estado: 'pagada', codigo: nuevoCodigo(), pagada: new Date(), ...extra }, doc.actualizado)) break;
    doc = await leer(ruta);
  }
}

// Deja todo listo para una orden pagada: el código en Firestore y los dos correos. Se puede repetir sin duplicar nada.
export async function completar(ruta, origen = 'NOWPayments') {
  let doc = await leer(ruta), o = doc.datos;
  const cod = 'codigos/' + o.codigo;
  if (!await leer(cod)) {
    await crear(cod, { tipo: PRODUCTOS[o.producto]?.tipo || o.producto, max: USOS_CODIGO, usos: 0, cliente: o.nombre + ' · ' + o.correo, orden: o.id,
      vence: new Date(Date.now() + diasDe(o.producto) * 864e5), created_at: Date.now(), origen });
  }
  // Cada correo se "reserva" en la orden antes de enviarlo, para que dos avisos al mismo tiempo no lo manden dos veces.
  for (const [campo, armar] of [['correo_cliente', () => correoCliente(o)], ['correo_aviso', () => correoAviso(o, 'Nuevo pago confirmado')]]) {
    if (o[campo]) continue;
    if (!await cambiar(ruta, { [campo]: new Date() }, doc.actualizado)) { doc = await leer(ruta); o = doc.datos; if (o[campo]) continue; if (!await cambiar(ruta, { [campo]: new Date() }, doc.actualizado)) continue; }
    try { await enviar(await armar()); } catch (e) { await cambiar(ruta, { [campo]: null }); throw e; }
    doc = await leer(ruta); o = doc.datos;
  }
}


// Con la asesoría va también la lista de requisitos de su caso (Elise, 25 oct. 2026): en el correo y como hoja para imprimir.
export async function correoCliente(o) {
  const videos = (await leer('publico/videos').catch(() => null))?.datos || {};
  const m = correoCodigo({ ...o, dias: diasDe(o.producto), dispositivos: MAX_DISPOSITIVOS, videos });
  if (o.producto !== 'asesoria' && o.producto !== 'plan') return m;
  const sel = deSim(o.sim, o.pais); if (o.producto === 'plan') sel.v = 'tierra';
  const secs = filtrar(await cargarLista(), sel);
  const url = sitio() + '/api/requisitos?codigo=' + encodeURIComponent(o.codigo);
  const fin = '</td></tr>\n<tr><td style="padding-top:24px;font-size:13px';
  m.html = m.html.replace(fin, `<p style="margin-top:26px;font-size:18px;font-weight:bold">${tituloHoja(sel)}</p>
<p>Esta es tu lista para ir reuniendo tus documentos. Imprímela y marca cada uno cuando lo tengas.</p>
<p style="text-align:center;margin:18px 0"><a href="${url}" style="background:#E0A526;color:#0E3B43;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block">Abrir e imprimir mi lista</a></p>${listaCorreo(secs)}` + fin);
  m.text += '\n\n' + tituloHoja(sel) + '\nImprime tu lista: ' + url + '\n\n' + listaTexto(secs);
  m.attachments = [{ filename: 'requisitos-kairos.html', content: hojaHtml(secs, sel, { nombre: o.nombre }), contentType: 'text/html; charset=utf-8' }];
  return m;
}
