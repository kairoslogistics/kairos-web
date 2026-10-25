# Kairos Logistics: web

- `sitio/`: la web pública, el panel (`/admin`) y la página de enlaces (`/enlaces`). Se arma con `web/netlify/preparar.py`; no se edita a mano.
- `netlify/functions/`: pagos con NOWPayments.
  - `crear-orden` (`/api/crear-orden`): guarda la orden en Firestore y crea la factura.
  - `nowpayments-ipn` (`/api/nowpayments-ipn`): recibe el aviso de pago, crea el código y envía los correos.
  - `paypal-config` (`/api/paypal-config`): da solo el `PAYPAL_CLIENT_ID` (público) para cargar el SDK de PayPal.
  - `create-order` (`/api/create-order`): guarda la orden y crea el pedido en PayPal (intent CAPTURE, USD). El monto sale de `PRODUCTOS`, nunca del navegador.
  - `capture-order` (`/api/capture-order`): cobra el pedido aprobado, revisa el monto, crea el código y devuelve estado e ID de transacción.
  - `orden` (`/api/orden?orden=…&correo=…`): la página pregunta si ya se pagó y muestra el código en pantalla.

Variables de entorno en Netlify: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS`, `SITE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` (app Live; el SECRET solo se usa en las funciones).
Opcionales: `NOWPAYMENTS_SANDBOX=si` (pruebas sin dinero), `CORREO_PRUEBA=si` (no envía correos), `CODIGO_DIAS` (por defecto 30), `ZOHO_SMTP_HOST` (por defecto smtp.zoho.com), `AVISOS_A`.
