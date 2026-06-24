/* =========================================================================
   data.js  —  Configuración global + catálogo de RESPALDO
   -------------------------------------------------------------------------
   👉 La fuente de verdad del catálogo es el archivo  data.json  (en la raíz).
   El sitio lo lee SIEMPRE fresco (sin caché), así al publicar todos ven el
   cambio de inmediato.

   Para cambiar productos/categorías/comentarios del sitio publicado:
     1) En el panel admin edita y pulsa "Publicar" (copia el data.json nuevo).
     2) Pega ese contenido reemplazando TODO  data.json  en VS Code.
     3) commit + push a GitHub → todos ven los cambios.

   Los DEFAULT_* de abajo son solo un RESPALDO (si data.json no carga, p. ej.
   al abrir con file://). Mantenerlos igual a data.json es opcional.
   ========================================================================= */

/* Configuración del negocio: punto único de verdad para datos de contacto. */
const CONFIG = {
  marca: "FITCORE HN",
  // Número de WhatsApp en formato internacional SIN signos ni espacios (wa.me).
  whatsapp: "50433644559",
  whatsappVisible: "+504 3364 4559",
  email: "cristopherval04@gmail.com",
  ciudades: ["Talanga", "Tegucigalpa"],
  moneda: "L.", // Lempira hondureño
  redes: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/"
  }
};

/* Claves de almacenamiento (centralizadas para evitar errores de tipeo). */
const STORAGE_KEYS = {
  productos: "fitcore_productos",
  categorias: "fitcore_categorias",
  testimonios: "fitcore_testimonios",
  carrito: "fitcore_carrito",
  adminPass: "fitcore_admin_pass",
  version: "fitcore_data_version"
};

/* Sube este número cuando cambies el catálogo de ejemplo (DEFAULT_*).
   Al cambiar, el catálogo de ejemplo se vuelve a cargar automáticamente
   (no afecta a una tienda en producción que ya no toque este valor). */
const DATA_VERSION = 3;

/* Página HTML dedicada para cada categoría (mejor SEO y enlaces limpios).
   Las categorías nuevas creadas en el panel usan categoria.html?cat=ID. */
const CATEGORIA_PAGES = {
  creatinas:   "creatinas.html",
  proteinas:   "proteinas.html",
  preentrenos: "preentrenos.html"
};

/* Categorías por defecto. `id` es estable; `nombre` es editable. */
const DEFAULT_CATEGORIAS = [
  { id: "creatinas",   nombre: "Creatinas",   descripcion: "Fuerza explosiva y recuperación muscular." },
  { id: "proteinas",   nombre: "Proteínas",   descripcion: "Construye y repara músculo de calidad." },
  { id: "preentrenos", nombre: "Pre-entrenos", descripcion: "Energía y enfoque para cada sesión." }
];

/* Productos por defecto (semilla). Precios en Lempiras (L.). */
const DEFAULT_PRODUCTOS = [
  {
    id: "p1",
    nombre: "Creatine Monohydrate Nutrex",
    precio: 650,
    precioAnterior: 790,
    categoria: "creatinas",
    descripcion: "Creatina monohidratada pura y micronizada. 300 g · 60 servicios. Fuerza y rendimiento.",
    imagen: "assets/creatina-nutrex.jpg",
    destacado: true
  },
  {
    id: "p2",
    nombre: "Micronized Creatine Optimum Nutrition",
    precio: 780,
    precioAnterior: null,
    categoria: "creatinas",
    descripcion: "La creatina #1 de USA. 100% monohidrato, 5 g por servicio. 300 g · 60 servicios.",
    imagen: "assets/creatina-on.jpg",
    destacado: true
  },
  {
    id: "p3",
    nombre: "Gold Standard 100% Whey",
    precio: 1950,
    precioAnterior: 2200,
    categoria: "proteinas",
    descripcion: "Optimum Nutrition. 24 g de proteína por servicio. Double Rich Chocolate · 5 lb · 74 servicios.",
    imagen: "assets/proteina-on.jpg",
    destacado: false
  },
  {
    id: "p4",
    nombre: "100% Whey Protein Nutrex",
    precio: 1150,
    precioAnterior: null,
    categoria: "proteinas",
    descripcion: "Lean Muscle Shake sabor chocolate. Recuperación y crecimiento. 2 lb · 26 servicios.",
    imagen: "assets/proteina-nutrex.jpg",
    destacado: true
  },
  {
    id: "p5",
    nombre: "Outrage Ultra Stim Pre-Workout",
    precio: 850,
    precioAnterior: 990,
    categoria: "preentrenos",
    descripcion: "Nutrex. Energía intensa, bombeo y enfoque. Sabor Fruit Punch · 30 servicios.",
    imagen: "assets/preentreno-outrage.jpg",
    destacado: true
  }
];

/* Imagen de portada (hero) para cada página de categoría.
   Si una categoría nueva no está aquí, usa HERO_DEFAULT. */
const HERO_POR_CATEGORIA = {
  creatinas:   "assets/gym-creatinas.jpg",
  proteinas:   "assets/gym-proteinas.jpg",
  preentrenos: "assets/supp-generic.jpg"
};
const HERO_DEFAULT = "assets/gym-amb2.jpg";

/* Imagen de PORTADA para la tarjeta de categoría en el inicio (mosaico).
   Permite elegir un producto bien encuadrado, distinto al primero del listado.
   Si no está aquí, se usa la imagen del primer producto de la categoría. */
const PORTADA_CATEGORIA = {
  proteinas: "assets/proteina-nutrex.jpg"
};

/* Imágenes de ambiente reutilizables en distintas secciones. */
const GALERIA = [
  "assets/gym-amb1.jpg",
  "assets/gym-amb2.jpg",
  "assets/gym-amb3.jpg",
  "assets/supp-shake.jpg"
];

/* Producto destacado para el "showcase 3D" junto a los testimonios. */
const SHOWCASE = {
  imagen: "assets/creatina-on.jpg",
  titulo: "Calidad que se siente",
  texto: "Cada producto que enviamos es 100% original y sellado de fábrica."
};

/* Reseñas estáticas (vitrina). En el futuro podrían venir de una BD. */
const TESTIMONIOS = [
  {
    nombre: "Carlos M.",
    ciudad: "Tegucigalpa",
    estrellas: 5,
    texto: "Pedí mi creatina un martes y la tuve el mismo día. Producto original y precios justos. Mi nueva tienda fija."
  },
  {
    nombre: "Andrea R.",
    ciudad: "Talanga",
    estrellas: 5,
    texto: "Excelente atención por WhatsApp, me asesoraron con la proteína ideal para mi objetivo. 100% recomendados."
  },
  {
    nombre: "José L.",
    ciudad: "Tegucigalpa",
    estrellas: 5,
    texto: "El pre-entreno Outrage es brutal, energía pura. Entrega rápida y todo sellado de fábrica."
  },
  {
    nombre: "María F.",
    ciudad: "Talanga",
    estrellas: 5,
    texto: "Compré la Gold Standard y llegó perfecta. Buen precio comparado con otras tiendas. Volveré a comprar."
  }
];
