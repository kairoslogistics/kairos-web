// Registro de gastos del viaje por tierra (Jesús, 27 oct. 2026). La página /gastos/ guarda cada gasto en el teléfono y,
// cuando hay internet, los manda aquí con el código de itinerario o de asesoría. Se juntan por id en gastos/{código}
// y se devuelven todos, para que el cliente los vea igual en otro teléfono. Kairos los ve en el panel (pestaña Gastos de viaje).
import { leer, crear, cambiar } from '../lib/firestore.mjs';
import { json, texto } from '../lib/comun.mjs';

const MONEDAS = ['USD', 'CLP', 'ARS', 'BRL', 'VES'], PAISES = ['cl', 'ar', 'br', 've', 'otro'];
const CATS = ['combustible', 'alimentacion', 'hospedaje', 'peaje', 'otro'], MAX_GASTOS = 600;
const ERR = {
  no: 'Ese código no existe o no es de un itinerario. Revisa que esté escrito igual que en tu correo.',
  anulado: 'Este código fue anulado porque la compra se canceló o se reembolsó.',
};
const num = (v, max) => { const n = +v; return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null; };

// Un gasto que llega de la página, revisado. El valor en dólares se calcula aquí con la tasa que usó el teléfono.
export function limpiarGasto(g) {
  const id = texto(g?.id, 30).replace(/[^a-z0-9]/gi, ''), monto = num(g?.monto, 1e10), moneda = MONEDAS.includes(g?.moneda) ? g.moneda : null;
  if (id.length < 6 || monto == null || !moneda) return null;
  const tasa = moneda === 'USD' ? 1 : num(g.tasa, 1e9) || null;
  return {
    id, monto, moneda, tasa,
    usd: tasa ? Math.round(monto / tasa * 100) / 100 : null,
    cat: CATS.includes(g.cat) ? g.cat : 'otro',
    desc: texto(g.desc, 80),
    pais: PAISES.includes(g.pais) ? g.pais : 'otro',
    fecha: num(g.fecha, 4102444800000) || Date.now(),
    cambiado: num(g.cambiado, 4102444800000) || Date.now(),
    ...(g.borrado ? { borrado: true } : {}),
  };
}

// Junta por id: gana la versión cambiada más tarde.
export function juntar(viejos, nuevos) {
  const m = new Map((viejos || []).map(g => [g.id, g]));
  for (const g of nuevos) { const ya = m.get(g.id); if (!ya || (+g.cambiado || 0) >= (+ya.cambiado || 0)) m.set(g.id, g); }
  return [...m.values()].sort((a, b) => a.fecha - b.fecha).slice(-MAX_GASTOS);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let d; try { d = await req.json(); } catch { return json({ error: 'Datos inválidos' }, 400); }
  const codigo = texto(d.codigo, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!codigo) return json({ error: ERR.no, motivo: 'no' }, 400);
  const nuevos = (Array.isArray(d.gastos) ? d.gastos.slice(0, MAX_GASTOS) : []).map(limpiarGasto).filter(Boolean);
  try {
    const c = (await leer('codigos/' + codigo))?.datos;
    if (!c || !['plan', 'asesoria'].includes(c.tipo)) return json({ error: ERR.no, motivo: 'no' }, 404);
    if (c.anulado) return json({ error: ERR.anulado, motivo: 'anulado' }, 410);
    for (let i = 0; i < 3; i++) {
      const doc = await leer('gastos/' + codigo), items = juntar(doc?.datos?.items, nuevos);
      if (!nuevos.length) return json({ ok: true, gastos: items });
      const datos = { codigo, cliente: c.cliente || '', items, actualizado: Date.now(), dispositivo: texto(d.equipo, 60) };
      const listo = doc ? await cambiar('gastos/' + codigo, datos, doc.actualizado) : await crear('gastos/' + codigo, { ...datos, creado: Date.now() });
      if (listo) return json({ ok: true, gastos: items });
    }
    return json({ error: 'Inténtalo de nuevo.' }, 409);
  } catch (e) {
    console.error('gastos', e.message);
    return json({ error: 'No pudimos guardar en este momento. Tus gastos siguen en el teléfono.', motivo: 'red' }, 500);
  }
};

export const config = { path: '/api/gastos' };
