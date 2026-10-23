/* =========================================================================
   categoria.js  —  Renderiza los productos de una categoría
   -------------------------------------------------------------------------
   Funciona en dos modos:
   · Páginas dedicadas (creatinas.html…): la categoría viene en
     <body data-cat="..."> y el H1/SEO ya están escritos en el HTML.
   · categoria.html?cat=ID: categoría dinámica; se rellena todo por JS.
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const run = () => {
  const esDedicada = !!document.body.dataset.cat;
  const params = new URLSearchParams(location.search);
  const catId = document.body.dataset.cat || params.get("cat");
  const cat = Store.getCategorias().find(c => c.id === catId);

  const heroBg  = document.getElementById("cat-hero-bg");
  const titleEl = document.getElementById("cat-title");
  const descEl  = document.getElementById("cat-desc");
  const countEl = document.getElementById("cat-count");
  const gridEl  = document.getElementById("cat-grid");
  const crumbEl = document.getElementById("cat-crumb");

  if (!cat) {
    if (titleEl) titleEl.textContent = "Categoría no encontrada";
    if (descEl) descEl.textContent = "Es posible que el enlace sea incorrecto o la categoría ya no exista.";
    if (gridEl) gridEl.innerHTML = `<p class="muted">Vuelve al <a href="index.html#categorias" class="text-accent">inicio</a>.</p>`;
    return;
  }

    // Fondo del encabezado. NO se usa cat.imagen a propósito: esa foto es
    // del producto —vertical y sobre fondo blanco— y estirada a todo lo
    // ancho deja la zona blanca justo detrás del logo. Van fotos pensadas
    // para fondo: la del mapa fijo, o la genérica.
    const hero = (typeof HERO_POR_CATEGORIA !== "undefined" && HERO_POR_CATEGORIA[cat.id])
      || (typeof HERO_DEFAULT !== "undefined" ? HERO_DEFAULT : "assets/gym-amb2.jpg");
    if (heroBg) heroBg.style.backgroundImage = `url('${hero}')`;

  // En páginas dedicadas el H1/descripcion están optimizados para SEO: no se tocan.
  if (!esDedicada) {
    if (titleEl) titleEl.textContent = cat.nombre;
    if (descEl) descEl.textContent = cat.descripcion || "Explora nuestra selección.";
    if (crumbEl) crumbEl.textContent = cat.nombre;
    document.title = `${cat.nombre} | FITCORE HN`;
  }

  const productos = Store.getProductos().filter(p => p.categoria === cat.id);
  if (countEl) countEl.textContent = `${productos.length} producto${productos.length !== 1 ? "s" : ""}`;

  /* Orden elegido por quien mira. "Recomendado" es el orden que le diste a
     los productos en el panel, que es el que vale por defecto. */
  const ordenar = (lista, modo) => {
    const l = [...lista];
    const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    switch (modo) {
      case "precio-asc":  return l.sort((a, b) => a.precio - b.precio || porNombre(a, b));
      case "precio-desc": return l.sort((a, b) => b.precio - a.precio || porNombre(a, b));
      case "nombre-asc":  return l.sort(porNombre);
      // Primero lo rebajado, y dentro de eso el descuento más grande.
      case "oferta":      return l.sort((a, b) => dcto(b) - dcto(a) || porNombre(a, b));
      default:            return l;
    }
  };

  const dcto = (p) => (p.precioAnterior && p.precioAnterior > p.precio)
    ? (1 - p.precio / p.precioAnterior) : 0;

  const pintar = (modo) => {
    if (!gridEl) return;
    const lista = ordenar(productos, modo);
    gridEl.innerHTML = lista.length
      ? lista.map((p, i) => UI.tarjetaProducto(p, i)).join("")
      : `<p class="muted">Aún no hay productos en esta categoría. ¡Pronto agregaremos más!</p>`;
    // Las tarjetas nuevas nacen con la animación de aparición: hay que
    // volver a observarlas o se quedarían invisibles.
    if (typeof UI !== "undefined" && UI.revelar) UI.revelar();
  };

  pintar("");

  // La barra solo aparece si hay de dónde elegir.
  const barra = document.getElementById("cat-orden");
  const sel = document.getElementById("cat-orden-sel");
  if (barra && sel && productos.length > 1) {
    barra.hidden = false;
    sel.addEventListener("change", () => pintar(sel.value));
  }
  // Datos estructurados de los productos de esta categoría (SEO).
  if (typeof UI !== "undefined" && UI.injectProductsJsonLd) {
    UI.injectProductsJsonLd(productos, cat.nombre);
  }
  };
  (typeof Store !== "undefined" && Store.ready ? Store.ready : Promise.resolve()).then(run);
});
