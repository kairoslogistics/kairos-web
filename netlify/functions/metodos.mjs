// Qué formas de pago están listas, para que la página no ofrezca una que todavía no tiene claves.
import { json } from '../lib/comun.mjs';
import { paypalActivo } from '../lib/paypal.mjs';
import { mpActivo, tasaClp } from '../lib/mercadopago.mjs';

export default async () => json({ paypal: paypalActivo(), cripto: !!process.env.NOWPAYMENTS_API_KEY, mp: mpActivo() ? { tasa: tasaClp() } : false });

export const config = { path: '/api/metodos' };
