// Lo que pasa cuando una orden queda pagada, igual para NOWPayments, Mercado Pago y Hotmart.
import { leer, crear, cambiar } from './firestore.mjs';
import { PRODUCTOS, DIAS_CODIGO, USOS_CODIGO, nuevoCodigo } from './comun.mjs';
import { enviar, correoCodigo, correoAviso } from './correo.mjs';

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
      vence: new Date(Date.now() + DIAS_CODIGO * 864e5), created_at: Date.now(), origen });
  }
  // Cada correo se "reserva" en la orden antes de enviarlo, para que dos avisos al mismo tiempo no lo manden dos veces.
  for (const [campo, armar] of [['correo_cliente', () => correoCodigo({ ...o, dias: DIAS_CODIGO })], ['correo_aviso', () => correoAviso(o, 'Nuevo pago confirmado')]]) {
    if (o[campo]) continue;
    if (!await cambiar(ruta, { [campo]: new Date() }, doc.actualizado)) { doc = await leer(ruta); o = doc.datos; if (o[campo]) continue; if (!await cambiar(ruta, { [campo]: new Date() }, doc.actualizado)) continue; }
    try { await enviar(armar()); } catch (e) { await cambiar(ruta, { [campo]: null }); throw e; }
    doc = await leer(ruta); o = doc.datos;
  }
}

