import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Precios en USD (Elise, 25 oct. 2026: solo asesoría 45, otro vehículo 15 e itinerario 30). El precio lo pone el servidor, nunca la página.
export const PRODUCTOS = {
  asesoria: { precio: 45, nombre: 'Asesoría completa para importar tu vehículo a Venezuela', incluye: 'el detalle de cada gasto, tu resumen en una hoja, el video completo y tu itinerario de viaje día por día' },
  extra: { precio: 15, nombre: 'Cálculo de otro vehículo', incluye: 'el detalle de cada gasto y tu resumen en una hoja para un vehículo más', tipo: 'calculo' },
  plan: { precio: 30, nombre: 'Itinerario de viaje día por día', incluye: 'tu itinerario, el mapa con las paradas y la ruta en Google Maps por tramos' },
};
export const PAISES = ['Venezuela', 'Chile', 'Argentina', 'Brasil', 'Estados Unidos', 'Panamá', 'Otro'];
// Cuánto dura el código. Cada código sirve para un vehículo; cada vehículo extra se paga aparte, 15 USD (Elise, 23 oct. 2026).
export const DIAS_CODIGO = +(process.env.CODIGO_DIAS || 30);
export const USOS_CODIGO = 1;
export const WHATSAPP = '+58 422 701 0497';
export const sitio = () => (process.env.SITE_URL || 'https://kairoslogistics.net').replace(/\/+$/, '');

// Sin 0/O ni 1/I para que no se confundan al escribirlo.
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const azar = n => [...randomBytes(n)].map(b => LETRAS[b % 32]).join('');
export const nuevoCodigo = () => azar(8);
export function nuevaOrden(fecha = new Date()) {
  return 'KL-' + fecha.toISOString().slice(0, 10).replace(/-/g, '') + '-' + azar(4);
}

// Firma de NOWPayments: HMAC-SHA512 del cuerpo con las claves ordenadas alfabéticamente (también las de adentro).
// Igual que el ejemplo oficial de NOWPayments (sortObject), que también convierte las listas en objetos.
const ordenar = v => v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = ordenar(v[k]), o), {}) : v;
export const firmar = (cuerpo, secreto) => createHmac('sha512', secreto).update(JSON.stringify(ordenar(cuerpo))).digest('hex');
export function firmaValida(cuerpo, firma, secreto) {
  if (!firma || !secreto) return false;
  const a = Buffer.from(firmar(cuerpo, secreto)), b = Buffer.from(String(firma).toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const json = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const correoValido = c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);

// Datos del cliente que piden los dos pagos (NOWPayments y Pago Móvil). Devuelve { error } o los datos limpios.
export const texto = (v, max = 120) => String(v ?? '').trim().slice(0, max);
export function validarCliente(d) {
  const p = PRODUCTOS[d.producto];
  const nombre = texto(d.nombre), correo = texto(d.correo, 160).toLowerCase(), whatsapp = texto(d.whatsapp, 30), pais = texto(d.pais, 40);
  if (!p) return { error: 'Elige qué quieres comprar.' };
  if (nombre.split(/\s+/).length < 2) return { error: 'Escribe tu nombre y apellido.' };
  if (!correoValido(correo)) return { error: 'Revisa tu correo.' };
  if (correo !== texto(d.correo2, 160).toLowerCase()) return { error: 'Los dos correos no coinciden.' };
  if (!/^\+\d[\d\s-]{6,}$/.test(whatsapp)) return { error: 'Escribe tu WhatsApp con el código de país, por ejemplo +56 9 1234 5678.' };
  if (!PAISES.includes(pais)) return { error: 'Elige tu país de residencia.' };
  if (d.acepto !== true) return { error: 'Debes aceptar que el código llegará a tu correo.' };
  // Solo valores simples y cortos de la simulación.
  const sim = Object.fromEntries(Object.entries(d.sim && typeof d.sim === 'object' ? d.sim : {}).slice(0, 40)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => [texto(k, 40), typeof v === 'string' ? texto(v, 300) : v]));
  return { p, nombre, correo, whatsapp, pais, sim };
}
