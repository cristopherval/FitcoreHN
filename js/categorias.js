/* =========================================================================
   categorias.js  —  Página con TODAS las categorías
   -------------------------------------------------------------------------
   La portada muestra solo las categorías principales (CATEGORIAS_PRINCIPALES)
   para no saturar el mosaico. Esta página lista TODAS las que existan en la
   base, así que una categoría nueva aparece acá sola, sin tocar código.

   Las tarjetas NO llevan la clase "reveal": se pintan después de que el
   observador de animaciones ya corrió, así que nacerían invisibles.
   ========================================================================= */

const Categorias = (() => {
  const fmt = (n) => `${CONFIG.moneda} ${Number(n).toLocaleString("es-HN")}`;

  /* Página propia si la tiene (mejor SEO); si no, la genérica. */
  const urlCategoria = (id) =>
    (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[id])
      ? CATEGORIA_PAGES[id]
      : `categoria.html?cat=${encodeURIComponent(id)}`;

  const pintar = () => {
    const cont = document.getElementById("todas-grid");
    if (!cont) return;

    const cats = Store.getCategorias();
    const productos = Store.getProductos();

    if (!cats.length) {
      cont.innerHTML = `<p class="muted">No hay categorías para mostrar.</p>`;
      return;
    }

    cont.innerHTML = cats.map(c => {
      const items = productos.filter(p => p.categoria === c.id);
      const prod = items[0];

      // Imagen propia de la categoría (panel) > portada fija > primer
      // producto > imagen genérica. El mismo criterio que la portada.
      const portada = (typeof PORTADA_CATEGORIA !== "undefined" && PORTADA_CATEGORIA[c.id]);
      const hero = (typeof HERO_POR_CATEGORIA !== "undefined" && HERO_POR_CATEGORIA[c.id])
        || "assets/gym-amb2.jpg";
      const img = c.imagen || portada || (prod ? prod.imagen : hero);

      const cuenta = items.length === 1 ? "1 producto" : `${items.length} productos`;
      const desde = items.length ? ` · desde ${fmt(Math.min(...items.map(p => p.precio)))}` : "";

      return `
        <a class="cat" href="${urlCategoria(c.id)}" aria-label="Ver ${c.nombre}">
          <div class="cat__media">
            <img src="${img}" alt="${prod ? prod.nombre : c.nombre}" loading="lazy">
          </div>
          <div class="cat__body">
            <h2 class="cat__title">${c.nombre}</h2>
            <p class="cat__meta">${cuenta}${desde}</p>
            <span class="cat__link">Ver categoría →</span>
          </div>
        </a>`;
    }).join("");
  };

  return { pintar };
})();

document.addEventListener("DOMContentLoaded", () => {
  // Esperamos el catálogo: hacen falta los productos para contar y mostrar
  // el precio más bajo de cada categoría.
  if (typeof Store !== "undefined" && Store.ready && Store.ready.then) {
    Store.ready.then(Categorias.pintar);
  } else {
    Categorias.pintar();
  }
});
