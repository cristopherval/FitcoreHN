# FITCORE HN — Landing Page E-commerce de Suplementos

Tienda de suplementos deportivos premium (HTML + CSS + JS puro, sin frameworks).
Paleta **negro / blanco / verde neón**, enfoque **Mobile-First**, optimizada para SEO y rendimiento.

## 🚀 Cómo ejecutar

No requiere compilación. Opciones:

1. **VS Code + Live Server** (recomendado): clic derecho sobre `index.html` → *Open with Live Server*.
2. **Abrir directo**: doble clic en `index.html` (funciona porque no usa peticiones de red).
3. **Servidor estático**: cualquiera (Netlify, Vercel, GitHub Pages, hosting tradicional). Solo sube la carpeta.

## 📁 Estructura

```
FitcoreHN/
├── index.html          # Home: hero, ofertas, categorías, productos, testimonios
├── contacto.html       # Página de contacto (form → WhatsApp)
├── admin.html          # Panel de administración (oculto, noindex)
├── robots.txt          # SEO
├── sitemap.xml         # SEO
├── assets/             # Imágenes optimizadas (logo, atletas, productos)
└── js/
    ├── data.js         # Configuración global + catálogo semilla
    ├── store.js        # Persistencia (localStorage) — única capa de datos
    ├── cart.js         # Carrito + checkout por WhatsApp
    ├── ui.js           # Render de la home (carrusel, categorías, productos)
    ├── main.js         # Navegación, sticky navbar, bottom nav, acceso admin
    └── admin.js        # CRUD de productos/categorías con modales de confirmación
└── css/
    └── styles.css      # Estilos completos y comentados
```

## 🔐 Acceso al panel de administración (oculto)

Tres métodos discretos:
- **Ruta directa:** abre `admin.html`.
- **Toque secreto:** haz clic **5 veces seguidas** sobre el logo "FITCORE".
- **Teclado:** `Ctrl + Alt + A`.

Contraseña inicial: **`admin1234`** (cámbiala dentro del panel → sección *Seguridad*).

Desde el panel puedes, sin tocar código:
- Agregar / editar / eliminar **productos** (foto, nombre, precio, precio anterior, descripción, categoría).
- Crear y administrar **categorías** dinámicamente.
- Toda **edición o eliminación pide confirmación** en un modal de seguridad.

## 🛒 Carrito y ventas

- El carrito es un panel lateral, persistente entre páginas (localStorage).
- Al finalizar, arma un mensaje con el detalle y abre **WhatsApp** al número configurado.

## ⚙️ Configuración rápida

Edita `js/data.js` → objeto `CONFIG`:
```js
whatsapp: "50433644559",          // sin signos ni espacios
email: "cristopherval04@gmail.com",
ciudades: ["Talanga", "Tegucigalpa"],
```

## 🗄️ Migrar a base de datos (futuro)

Todo el acceso a datos está aislado en `js/store.js`. Para conectar una API/BD real
solo se reescriben esas funciones (`getProductos`, `setProductos`, etc.) manteniendo la firma;
el resto del sitio no cambia.

## 📈 SEO incluido

- HTML5 semántico (`header`, `nav`, `main`, `section`, `article`, `footer`).
- Meta description, keywords, Open Graph y Twitter Card.
- Datos estructurados JSON-LD (`Store`).
- `robots.txt`, `sitemap.xml`, `lang="es"`, `alt` en imágenes, `admin.html` con `noindex`.
- Fuentes con `preconnect` + `display=swap`; imágenes `lazy` y hero con `preload`.
