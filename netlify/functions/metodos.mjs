// Qué formas de pago están listas, para que la página no ofrezca una que todavía no tiene claves.
import { json } from '../lib/comun.mjs';
import { mpActivo, tasaClp } from '../lib/mercadopago.mjs';
import { productosHotmart } from '../lib/hotmart.mjs';

export default async () => json({ cripto: !!process.env.NOWPAYMENTS_API_KEY, mp: mpActivo() ? { tasa: await tasaClp() } : false, hotmart: productosHotmart() });

export const config = { path: '/api/metodos' };
