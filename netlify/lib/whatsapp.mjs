// Aviso a Elise por WhatsApp con CallMeBot (gratis, solo para mensajes a su propio número).
// Para activarlo: guardar +34 644 71 81 99 en contactos, enviarle por WhatsApp «I allow callmebot to send me messages»,
// y pegar en Netlify CALLMEBOT_TELEFONO (con código de país, ej. +56912345678) y CALLMEBOT_APIKEY (la que responde el bot).
// Sin esas variables no hace nada (el aviso por correo sigue saliendo).
export async function avisoWhatsApp(texto) {
  const tel = (process.env.CALLMEBOT_TELEFONO || '').replace(/[^\d+]/g, ''), key = process.env.CALLMEBOT_APIKEY;
  if (!tel || !key) return false;
  const r = await fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(tel) + '&text=' + encodeURIComponent(texto) + '&apikey=' + encodeURIComponent(key));
  if (!r.ok) throw new Error('CallMeBot ' + r.status);
  return true;
}
