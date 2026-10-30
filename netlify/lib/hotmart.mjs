// Hotmart (Jesús, 25 oct. 2026): cobra en varios países con tarjeta y medios locales. Cada producto de la web es un producto en Hotmart.
// En Netlify: HOTMART_HOTTOK (el «hottok» de Herramientas → Webhook) y el enlace de pago de cada producto:
// HOTMART_ASESORIA, HOTMART_EXTRA, HOTMART_PLAN, HOTMART_GASTOS (por ejemplo https://pay.hotmart.com/A123456789B).
export const enlaceHotmart = producto => (process.env['HOTMART_' + String(producto).toUpperCase()] || '').trim();
export const hotmartActivo = producto => !!(process.env.HOTMART_HOTTOK && enlaceHotmart(producto));
export const productosHotmart = () => ['asesoria', 'extra', 'plan', 'gastos'].filter(hotmartActivo);

// Enlace de pago con la orden en «xcod»: Hotmart la devuelve en el aviso. El correo y el nombre quedan escritos en el formulario de Hotmart.
export function urlHotmart({ producto, id, correo, nombre }) {
  const u = new URL(enlaceHotmart(producto));
  u.searchParams.set('xcod', id); u.searchParams.set('email', correo); u.searchParams.set('name', nombre); u.searchParams.set('checkoutMode', '10');
  return u.toString();
}
