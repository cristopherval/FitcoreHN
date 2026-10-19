# FITCORE HN — Tienda de suplementos

Tienda en línea de suplementos deportivos con **envíos a todo Honduras**.
HTML + CSS + JavaScript puro, sin frameworks ni compilación. Se publica como
sitio estático en GitHub Pages ([fitcore-hn.com](https://fitcore-hn.com)) y usa
**Supabase** como base de datos.

## 🚀 Cómo ejecutar

No requiere compilación:

1. **VS Code + Live Server** (recomendado): clic derecho en `index.html` → *Open with Live Server*.
2. **Servidor estático**: sube la carpeta tal cual.

> Hace falta conexión a internet: el catálogo se lee de Supabase. Si no responde,
> el sitio muestra el catálogo de respaldo de `js/data.js` para no verse vacío.

## 📁 Estructura

```
FitcoreHN/
├── index.html              # Portada
├── creatinas.html          # Páginas de categoría (SEO)
├── proteinas.html
├── preentrenos.html
├── categoria.html          # Categoría genérica (categoria.html?cat=ID)
├── producto.html           # Ficha de producto (producto.html?p=SLUG)
├── talanga.html            # Páginas de ciudad (SEO local)
├── tegucigalpa.html
├── san-pedro-sula.html
├── checkout.html           # Compra en un solo paso (noindex)
├── pedido.html             # Confirmación y seguimiento (noindex)
├── nosotros.html
├── contacto.html
├── terminos.html           # Legales
├── privacidad.html
├── devoluciones.html
├── admin.html              # Panel de administración (oculto, noindex)
├── robots.txt · sitemap.xml · llms.txt
├── .github/workflows/
│   └── keep-supabase-alive.yml   # Evita que Supabase se pause (ver abajo)
├── supabase/               # SQL — NO se sube al repo (.gitignore)
├── assets/                 # Imágenes + vendor/supabase.js
├── css/styles.css
└── js/
    ├── supabase-config.js  # Cliente Supabase (URL + clave anon pública)
    ├── data.js             # CONFIG, PAGOS y catálogo de respaldo
    ├── store.js            # Capa de datos: catálogo de Supabase, carrito local
    ├── cart.js             # Carrito lateral
    ├── checkout.js         # Compra: datos, zona, pago y comprobante
    ├── pedido.js           # Página del pedido del cliente
    ├── producto.js         # Ficha de producto + galería
    ├── ui.js               # Render de portada y tarjetas
    ├── categoria.js        # Render de categorías
    ├── search.js           # Buscador
    ├── confirm.js          # Modal de confirmación
    ├── main.js             # Navegación, FAQ, acceso al panel
    ├── pet3d.js            # Mascota 3D (escritorio)
    ├── adminpanel.js       # Panel: productos, categorías, marcas, galería
    └── adminpedidos.js     # Panel: pedidos y zonas de envío
```

## 🛒 Cómo funciona una venta

Todo ocurre en **un solo paso**: el cliente no reserva para pagar después.

1. Arma el carrito y entra a `checkout.html`.
2. Llena sus datos y elige **zona de entrega** (el costo sale de la base).
3. Elige forma de pago: **transferencia** (ve el monto y las cuentas, y adjunta
   la foto del comprobante ahí mismo) o **coordinar por WhatsApp**.
4. Al enviarlo llega un aviso por **Telegram** y el pedido aparece en el panel.
5. Se contacta al cliente, se entrega y se marca **entregada**.

**El total lo calcula Supabase**, no el navegador: el cliente solo manda qué
producto y cuántos. Es lo que impide que alguien edite el JavaScript y pague
L. 1 por una proteína.

Estados de un pedido: `nueva` → `entregada` o `cancelada`.

> Una compra puede entrar **sin comprobante** si el cliente abandona a mitad:
> el pedido se crea y luego se adjunta el archivo. El panel las marca en rojo.

## 🔐 Panel de administración

Tres formas de llegar a `admin.html`:
- Ruta directa.
- **5 clics seguidos** sobre el logo "FITCORE".
- `Ctrl + Alt + A`.

Login real con **Supabase Auth** (correo + contraseña, se administran en
Supabase → Authentication → Users). No hay contraseñas en el código.

Desde el panel, sin tocar código:
- **Pedidos**: ver, contactar por WhatsApp, revisar el comprobante, marcar
  entregada o cancelar.
- **Productos**: alta, edición, borrado y **galería de varias imágenes**
  (vistas, sabores, tabla nutricional), ordenables y con texto alternativo.
- **Categorías** y **marcas**.
- **Envíos**: crear zonas y cambiar sus costos y condiciones.

## ⚙️ Configuración

**Negocio y pagos** → `js/data.js`:
- `CONFIG`: WhatsApp, correo, cobertura.
- `PAGOS`: cuentas bancarias, titular e identidad (el banco pide ambos),
  `transferenciaActiva` y `tarjetaActiva`.

**Base de datos** → `js/supabase-config.js`. La clave anon es pública a
propósito: la seguridad la dan las políticas RLS.

**Costos de envío** → no están en el código, viven en la tabla `zonas_envio`
y se editan desde el panel.

## 🗄️ Base de datos (Supabase)

Los archivos SQL están en `supabase/`, **fuera del repositorio** (`.gitignore`),
porque uno contiene el token del bot de Telegram. Se ejecutan en el SQL Editor:

| Archivo | Qué crea |
|---|---|
| `pedidos.sql` | Zonas de envío, pedidos, líneas, bucket privado de comprobantes y las funciones públicas |
| `notificaciones.sql` | Avisos por Telegram al entrar un pedido |
| `productos-imagenes.sql` | Galería por producto y `slug` para URLs legibles |

Son **idempotentes**: se pueden correr las veces que haga falta.

**Modelo de seguridad:** las tablas de pedidos no son accesibles al público.
El cliente solo puede llamar a cuatro funciones controladas (`crear_pedido`,
`ver_pedido`, `registrar_voucher`, `pedido_admite_voucher`). Los comprobantes
van a un bucket **privado**: solo se ven desde el panel con enlaces firmados
que expiran, y solo se puede subir uno por pedido.

Cada pedido tiene un **token** aleatorio que hace de llave para que el cliente
consulte su estado sin registrarse. No hay cuentas de cliente a propósito:
obligar a crear una es de las primeras causas de carrito abandonado.

## 🔔 Avisos por Telegram

Al completarse un pedido, Supabase le avisa al bot por `pg_net`. Llegan dos
mensajes: uno con el detalle de la compra y otro corto al recibirse el
comprobante. El token vive en la tabla `ajustes_notificacion`, que **no se
puede leer desde el navegador**.

Si Telegram falla, la venta se completa igual: un aviso que no sale nunca debe
impedir una compra.

## ⏰ Keep-alive de Supabase

El plan gratuito de Supabase **se pausa tras 7 días sin actividad**.
`.github/workflows/keep-supabase-alive.yml` consulta la base cada 2 días.

Además, GitHub desactiva los workflows programados de un repo público tras
**60 días sin actividad**. Por eso el flujo hace un commit de sello si el repo
lleva más de 45 días quieto: así no se apaga solo.

## 📈 SEO

- Datos estructurados: `Store`, `FAQPage`, `BreadcrumbList`, `Product` (con
  precio, que es lo que permite a Google mostrarlo en los resultados).
- Las preguntas marcadas **coinciden palabra por palabra** con el texto visible:
  si no, Google puede retirar los resultados enriquecidos.
- Páginas de ciudad con contenido propio en cada una. Repetir el mismo texto
  cambiando el nombre de la ciudad es contenido duplicado y Google lo descarta.
- URLs de producto con `slug` legible (`producto.html?p=gold-standard-100-whey`).
- `robots.txt`, `sitemap.xml`, `llms.txt`, canonical, Open Graph y Twitter Card.
- `checkout.html` y `pedido.html` con `noindex`: son transaccionales y llevan
  datos de un pedido.

## 📝 Convenciones

- **Trato de "tú"** en todo el sitio.
- **Caché**: los `<script>` y `<link>` llevan `?v=NN`. Al cambiar un JS o el CSS
  hay que **subir ese número en todo el sitio**, o quien ya visitó seguirá
  viendo el archivo viejo.
- Todo el acceso a datos pasa por `js/store.js` o por las funciones RPC.
- Los precios se muestran con `CONFIG.moneda` y `toLocaleString("es-HN")`.
