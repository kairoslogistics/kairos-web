// Calendario de la asesoría 1 a 1 en vivo (150 USD). Pedido de Elise, 2 nov. 2026.
// - Lunes a viernes de 9:00 a 21:00, hora de Venezuela (America/Caracas, UTC-4 todo el año). El cliente ve su hora local.
// - Cada asesoría dura de 60 a 90 minutos: se reservan 90.
// - Bloqueos fijos: todos los días de 11:30 a 13:30 (buscar a los niños) y los jueves toda la tarde hasta las 17:00.
// - Unas 5 horas al azar por semana se muestran como «reservadas» (escasez). El azar es fijo por semana: no cambia al recargar.
// - Una solicitud NO bloquea la hora. La hora se reserva cuando Elise confirma el pago en el panel (/admin/agenda/),
//   que la guarda en publico/agenda.ocupadas. Ahí también van los bloqueos que ella ponga a mano.

export const AGENDA = {
  zona: 'America/Caracas',
  dias: [1, 2, 3, 4, 5],          // 1 = lunes … 5 = viernes
  desde: 9 * 60, hasta: 21 * 60,  // minutos del día, hora Venezuela
  duracion: 90,                    // minutos que ocupa cada asesoría
  paso: 60,                        // una hora de inicio cada 60 min
  // Zona en que están escritos los bloqueos fijos. Si la hora de los niños es la de Chile, cambiar a 'America/Santiago'.
  zonaBloqueos: 'America/Caracas',
  bloqueos: { todos: [[11 * 60 + 30, 13 * 60 + 30]], 4: [[12 * 60, 17 * 60]] },  // 4 = jueves
  azarPorSemana: 5,                // horarios que se ven tomados cada semana
  semanas: 3,                      // cuántos días hacia adelante se muestran (en semanas)
  antelacion: 90,                  // se puede pedir una hora que empiece en 90 min o más (entra a las 13:00, agenda a las 15:00)
};

// Elise (6 nov. 2026): asesoría marítima de 35 USD. Llamada de 20 a 25 min (se reservan 30), mismos días, horas y bloqueos fijos.
// Comparte la agenda con la 1 a 1: una hora pagada de cualquiera de las dos bloquea a la otra.
export const TIPOS = {
  '1a1': { nombre: 'asesoría 1 a 1', titulo: 'Asesoría 1 a 1', precio: 150, cfg: AGENDA },
  maritima: { nombre: 'asesoría marítima', titulo: 'Asesoría marítima', precio: 35, cfg: { ...AGENDA, duracion: 30, paso: 30 } },
};
export const tipoDe = t => (TIPOS[t] ? t : '1a1');
const SAL = 'kairos-1a1';
const MIN = 60000, DIA = 86400000;
const OFFSET_VE = -4 * 60; // Venezuela no cambia de hora

const partes = new Map();
function enZona(zona, ms) {
  let f = partes.get(zona);
  if (!f) partes.set(zona, f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' }));
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
}
// ¿El tramo [ini, fin) toca un bloqueo fijo? Se revisa minuto a minuto cada 15 min en la zona de los bloqueos.
function bloqueado(ini, fin, cfg) {
  for (let t = ini; t < fin; t += 15 * MIN) {
    const { dia, min } = enZona(cfg.zonaBloqueos, t);
    for (const [a, b] of [...(cfg.bloqueos.todos || []), ...(cfg.bloqueos[dia] || [])]) if (min >= a && min < b) return true;
  }
  return false;
}
// Medianoche de Venezuela (en ms UTC) del día que contiene ms.
const medianocheVE = ms => Math.floor((ms + OFFSET_VE * MIN) / DIA) * DIA - OFFSET_VE * MIN;
const diaVE = ms => new Date(ms + OFFSET_VE * MIN).getUTCDay();
const lunesVE = ms => medianocheVE(ms) - ((diaVE(ms) + 6) % 7) * DIA;

// Horas de inicio posibles de un día (sin mirar reservas): salta de a 30 min cuando choca con un bloqueo.
export function inicioDelDia(medianoche, cfg = AGENDA) {
  if (!cfg.dias.includes(diaVE(medianoche))) return [];
  const out = [];
  for (let t = cfg.desde; t + cfg.duracion <= cfg.hasta;) {
    const ini = medianoche + t * MIN;
    if (bloqueado(ini, ini + cfg.duracion * MIN, cfg)) { t += 30; continue; }
    out.push(ini); t += cfg.paso;
  }
  return out;
}

// Generador con semilla (mulberry32) para que el azar de cada semana sea siempre el mismo.
function semilla(texto) { let h = 1779033703; for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19; return h >>> 0; }
function azar(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function tomadasAlAzar(lunes, cfg = AGENDA) {
  const todas = []; for (let i = 0; i < 7; i++) todas.push(...inicioDelDia(lunes + i * DIA, cfg));
  const r = azar(semilla(SAL + new Date(lunes).toISOString().slice(0, 10))), elegidas = new Set();
  // No dos seguidas del mismo día, para que no parezca un bloque.
  for (let n = 0; elegidas.size < Math.min(cfg.azarPorSemana, todas.length) && n < 200; n++) {
    const t = todas[Math.floor(r() * todas.length)];
    if ([...elegidas].some(e => Math.abs(e - t) <= cfg.paso * MIN)) continue;
    elegidas.add(t);
  }
  return elegidas;
}

// Horarios de los próximos días. ocupadas = [{inicio, fin}] (pagadas o bloqueadas a mano, en ms).
// Devuelve [{ inicio, libre }] solo de horas futuras (con la antelación mínima).
export function horarios(ocupadas = [], ahora = Date.now(), cfg = AGENDA) {
  const hoy = medianocheVE(ahora), out = [], azarSem = new Map();
  for (let i = 0; i < cfg.semanas * 7; i++) {
    const m = hoy + i * DIA;
    for (const ini of inicioDelDia(m, cfg)) {
      if (ini < ahora + cfg.antelacion * MIN) continue;
      const fin = ini + cfg.duracion * MIN, lun = lunesVE(ini);
      if (!azarSem.has(lun)) azarSem.set(lun, tomadasAlAzar(lun));
      // En la 1 a 1 el azar marca horas exactas; en las más cortas (marítima), las horas al azar de la 1 a 1 ocupan sus 90 min.
      const az = azarSem.get(lun), tomadaAzar = cfg === AGENDA || cfg.duracion === AGENDA.duracion ? az.has(ini) : [...az].some(t => t < fin && t + AGENDA.duracion * MIN > ini);
      const tomada = tomadaAzar || ocupadas.some(o => +o.inicio < fin && +o.fin > ini);
      out.push({ inicio: ini, libre: !tomada });
    }
  }
  return out;
}

// Texto «lunes 3 de noviembre, 15:00» en hora de Venezuela.
export const fechaVE = ms => new Intl.DateTimeFormat('es-VE', { timeZone: AGENDA.zona, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
// Texto en la zona del cliente (si su navegador la dio).
export function fechaEn(zona, ms) {
  try { return new Intl.DateTimeFormat('es', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); }
  catch { return null; }
}
