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

  // Hero (imagen de fondo). En las dedicadas también va escrito en el HTML.
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
  if (gridEl) {
    gridEl.innerHTML = productos.length
      ? productos.map((p, i) => UI.tarjetaProducto(p, i)).join("")
      : `<p class="muted">Aún no hay productos en esta categoría. ¡Pronto agregaremos más!</p>`;
  }
  };
  (typeof Store !== "undefined" && Store.ready ? Store.ready : Promise.resolve()).then(run);
});
