import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Precios en USD (Elise, 22 oct. 2026). El precio lo pone el servidor, nunca la página.
export const PRODUCTOS = {
  asesoria: { precio: 40, nombre: 'Asesoría para importar tu vehículo', incluye: 'el detalle de cada gasto, tu resumen en una hoja, el video completo y tu plan de viaje' },
  calculo: { precio: 25, nombre: 'Cálculo completo de importación', incluye: 'el detalle de cada gasto y tu resumen en una hoja. Si contratas el servicio con Kairos, te descontamos estos 25 USD' },
  extra: { precio: 15, nombre: 'Detalle de otro vehículo', incluye: 'el detalle de cada gasto y tu resumen en una hoja para un vehículo más', tipo: 'calculo' },
  plan: { precio: 20, nombre: 'Plan de viaje día por día', incluye: 'tu itinerario, el mapa con las paradas y la ruta en Google Maps por tramos' },
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
