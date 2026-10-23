// Firestore por REST con la cuenta de servicio de Firebase (sin librerías). La cuenta de servicio no pasa por las reglas,
// así que estas funciones pueden escribir órdenes y códigos; la web pública solo lee códigos (ver admin-firebase/firestore.rules).
import { createSign } from 'node:crypto';

const PROYECTO = process.env.FIREBASE_PROJECT_ID || 'kairos-logistics-584fd';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/`;
let token = null, vence = 0;

const b64 = s => Buffer.from(s).toString('base64url');
async function acceso() {
  if (token && Date.now() < vence - 60000) return token;
  const correo = process.env.FIREBASE_CLIENT_EMAIL, llave = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!correo || !llave) throw new Error('Faltan FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY');
  const ahora = Math.floor(Date.now() / 1000);
  const sinFirma = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: correo, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  }));
  const firma = createSign('RSA-SHA256').update(sinFirma).sign(llave, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + sinFirma + '.' + firma,
  });
  if (!r.ok) throw new Error('Google no dio acceso: ' + r.status);
  const j = await r.json(); token = j.access_token; vence = Date.now() + j.expires_in * 1000;
  return token;
}

export function aValor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
  return { mapValue: { fields: aCampos(v) } };
}
export const aCampos = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, aValor(v)]));
export function deValor(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
}
export const deCampos = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, deValor(v)]));

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, { ...opciones, headers: { Authorization: 'Bearer ' + await acceso(), 'Content-Type': 'application/json' } });
  return r;
}

// Devuelve { datos, actualizado } o null si no existe.
export async function leer(ruta) {
  const r = await pedir(ruta);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore leer ' + ruta + ': ' + r.status);
  const j = await r.json();
  return { datos: deCampos(j.fields), actualizado: j.updateTime };
}

// Crea el documento solo si no existe. Devuelve false si ya existía.
export async function crear(ruta, datos) {
  const r = await pedir(ruta + '?currentDocument.exists=false', { method: 'PATCH', body: JSON.stringify({ fields: aCampos(datos) }) });
  if (r.status === 409 || r.status === 400) return false;
  if (!r.ok) throw new Error('Firestore crear ' + ruta + ': ' + r.status);
  return true;
}

// Cambia solo los campos dados. Con siActualizado, falla (devuelve false) si otro aviso cambió el documento antes.
export async function cambiar(ruta, datos, siActualizado) {
  const q = Object.keys(datos).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&') + (siActualizado ? '&currentDocument.updateTime=' + encodeURIComponent(siActualizado) : '&currentDocument.exists=true');
  const r = await pedir(ruta + '?' + q, { method: 'PATCH', body: JSON.stringify({ fields: aCampos(datos) }) });
  if (r.status === 409 || r.status === 400 || r.status === 412) return false;
  if (!r.ok) throw new Error('Firestore cambiar ' + ruta + ': ' + r.status);
  return true;
}
