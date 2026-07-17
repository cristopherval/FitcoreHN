# FITCORE HN — Landing Page E-commerce de Suplementos

Tienda de suplementos deportivos premium (HTML + CSS + JS puro, sin frameworks).
Paleta **negro / blanco / verde neón**, enfoque **Mobile-First**, optimizada para SEO y rendimiento.

## 🚀 Cómo ejecutar

No requiere compilación. Opciones:

1. **VS Code + Live Server** (recomendado): clic derecho sobre `index.html` → *Open with Live Server*.
2. **Servidor estático**: cualquiera (Netlify, Vercel, GitHub Pages, hosting tradicional). Solo sube la carpeta.

> El catálogo se lee de **Supabase**, así que hace falta conexión a internet.
> Si Supabase no responde, el sitio muestra el catálogo de respaldo (`js/data.js`).

## 📁 Estructura

```
FitcoreHN/
├── index.html            # Home: hero, ofertas, categorías, productos, testimonios
├── creatinas/proteinas/  # Páginas dedicadas por categoría (SEO)
│   preentrenos.html
├── categoria.html        # Página genérica de categoría (categoria.html?cat=ID)
├── contacto.html         # Página de contacto (form → WhatsApp)
├── admin.html            # Panel de administración (oculto, noindex)
├── robots.txt            # SEO
├── sitemap.xml           # SEO
├── assets/               # Imágenes optimizadas + vendor/supabase.js
├── supabase/             # schema.sql y seed.sql (base de datos)
├── css/
│   └── styles.css        # Estilos completos y comentados
└── js/
    ├── supabase-config.js # Cliente Supabase (URL + clave anon pública)
    ├── data.js            # Configuración global (CONFIG) + catálogo de respaldo
    ├── store.js           # Única capa de datos: lee de Supabase; carrito en localStorage
    ├── confirm.js         # Modal de confirmación reutilizable
    ├── cart.js            # Carrito + checkout por WhatsApp
    ├── ui.js              # Render de la home (carrusel, categorías, productos)
    ├── categoria.js       # Render de las páginas de categoría
    ├── main.js            # Navegación, sticky navbar, bottom nav, acceso admin
    └── adminpanel.js      # CRUD de productos con Supabase (login, subida de fotos)
```

## 🔐 Acceso al panel de administración (oculto)

Tres métodos discretos para llegar a `admin.html`:
- **Ruta directa:** abre `admin.html`.
- **Toque secreto:** haz clic **5 veces seguidas** sobre el logo "FITCORE".
- **Teclado:** `Ctrl + Alt + A`.

El panel usa **login real de Supabase Auth** (correo + contraseña). Las credenciales
se administran desde el panel de Supabase (Authentication → Users); no hay una
contraseña "en el código".

Desde el panel puedes, sin tocar código:
- Agregar / editar / eliminar **productos** (foto, nombre, precio, precio anterior, descripción, categoría).
- Marcar dónde aparece cada producto: **categoría**, **más vendidos** y **ofertas de la semana**.
- Las fotos se suben a **Supabase Storage** (bucket `productos`).
- Toda **eliminación pide confirmación** en un modal de seguridad.

## 🛒 Carrito y ventas

- El carrito es un panel lateral, persistente entre páginas (localStorage).
- Al finalizar, arma un mensaje con el detalle y abre **WhatsApp** al número configurado.

## ⚙️ Configuración rápida

**Datos del negocio** → `js/data.js`, objeto `CONFIG`:
```js
whatsapp: "50433644559",          // sin signos ni espacios
email: "cristopherval04@gmail.com",
ciudades: ["Talanga", "Tegucigalpa"],
```

**Conexión a la base de datos** → `js/supabase-config.js` (`SUPABASE_URL` y
`SUPABASE_ANON_KEY`). La clave anon es pública a propósito: la seguridad la dan
las políticas RLS definidas en `supabase/schema.sql`.

## 🗄️ Base de datos (Supabase)

Todo el acceso a datos está aislado en `js/store.js`. El catálogo (productos y
categorías) vive en Supabase; el esquema y las políticas de seguridad están en
`supabase/schema.sql` (ejecútalo una vez en el SQL Editor de Supabase). Los
`DEFAULT_*` de `js/data.js` son solo el respaldo que se muestra si la base no responde.

## 📈 SEO incluido

- HTML5 semántico (`header`, `nav`, `main`, `section`, `article`, `footer`).
- Meta description, keywords, Open Graph y Twitter Card.
- Datos estructurados JSON-LD (`Store`).
- `robots.txt`, `sitemap.xml`, `lang="es"`, `alt` en imágenes, `admin.html` con `noindex`.
- Fuentes con `preconnect` + `display=swap`; imágenes `lazy` y hero con `preload`.
