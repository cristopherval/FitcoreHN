/* =========================================================================
   catmenu.js  —  Menú desplegable de categorías
   -------------------------------------------------------------------------
   Se abre desde "Categorías" del menú superior (escritorio) y desde el botón
   "Categorías" de la barra inferior (celular), que son los dos sitios desde
   donde se navega. La hamburguesa del navbar nunca llega a mostrarse.

   La lista sale de la base, así que una categoría nueva creada en el panel
   aparece acá sola, sin tocar código.

   Las opciones se pintan DESPUÉS de que el observador de animaciones ya
   corrió, por eso no usan la clase "reveal": nacerían invisibles.
   ========================================================================= */

const CatMenu = (() => {
  let panel = null;
  let pintado = false;

  /* Página propia si la tiene (mejor SEO); si no, la genérica. */
  const urlCategoria = (id) =>
    (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[id])
      ? CATEGORIA_PAGES[id]
      : `categoria.html?cat=${encodeURIComponent(id)}`;

  const construir = () => {
    panel = document.createElement("div");
    panel.className = "catmenu";
    panel.id = "catmenu";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Categorías");
    panel.innerHTML = `
      <div class="catmenu__head">
        <span>Categorías</span>
        <button type="button" class="catmenu__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="catmenu__lista"><p class="muted catmenu__cargando">Cargando…</p></div>`;
    document.body.appendChild(panel);

    panel.querySelector(".catmenu__close").addEventListener("click", cerrar);
  };

  const pintar = () => {
    if (pintado || typeof Store === "undefined") return;
    const cats = Store.getCategorias();
    const productos = Store.getProductos();
    const cont = panel.querySelector(".catmenu__lista");

    if (!cats.length) {
      cont.innerHTML = `<p class="muted catmenu__cargando">No hay categorías.</p>`;
      return;
    }

    cont.innerHTML = cats.map(c => {
      const n = productos.filter(p => p.categoria === c.id).length;
      return `
        <a class="catmenu__item" href="${urlCategoria(c.id)}">
          <span class="catmenu__nombre">${c.nombre}</span>
          <span class="catmenu__n">${n}</span>
        </a>`;
    }).join("") +
      `<a class="catmenu__todas" href="categorias.html">Ver todas con fotos →</a>`;

    pintado = true;
  };

  const abierto = () => panel && panel.classList.contains("is-open");

  const abrir = () => {
    pintar();
    panel.classList.add("is-open");
    document.querySelectorAll("[data-catmenu]").forEach(b =>
      b.setAttribute("aria-expanded", "true"));
  };

  const cerrar = () => {
    if (!panel) return;
    panel.classList.remove("is-open");
    document.querySelectorAll("[data-catmenu]").forEach(b =>
      b.setAttribute("aria-expanded", "false"));
  };

  const alternar = () => (abierto() ? cerrar() : abrir());

  const init = () => {
    const disparadores = document.querySelectorAll("[data-catmenu]");
    if (!disparadores.length) return;

    construir();

    disparadores.forEach(b => {
      b.setAttribute("aria-haspopup", "true");
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", (e) => { e.preventDefault(); alternar(); });
    });

    // Un clic fuera del panel lo cierra, salvo si fue en el propio botón.
    document.addEventListener("click", (e) => {
      if (!abierto()) return;
      if (panel.contains(e.target) || e.target.closest("[data-catmenu]")) return;
      cerrar();
    });

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

    // Si el catálogo llega después, repintamos para no mostrar "Cargando…".
    if (typeof Store !== "undefined" && Store.ready && Store.ready.then) {
      Store.ready.then(() => { pintado = false; pintar(); });
    }
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", CatMenu.init);
