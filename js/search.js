/* =========================================================================
   search.js  —  Búsqueda global (marcas, categorías y productos)
   -------------------------------------------------------------------------
   Inyecta un botón de lupa en la navbar de cada página y un overlay que
   filtra EN VIVO (mientras escribes) sobre el catálogo del Store.
   No necesita HTML propio en cada página: todo se crea por JS (como confirm.js).
   ========================================================================= */

const Search = (() => {
  /* Normaliza para comparar sin distinguir mayúsculas ni tildes. */
  const norm = (s) => (s == null ? "" : String(s))
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  let overlay, input, results;

  /* Ícono de lupa reutilizable. */
  const LUPA = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;

  /* --- Construcción del overlay (una sola vez) --- */
  const construir = () => {
    overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.id = "search-overlay";
    overlay.innerHTML = `
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="Buscar">
        <div class="search-bar">
          <span class="search-bar__ico" aria-hidden="true">${LUPA}</span>
          <input id="search-input" class="search-bar__input" type="search" autocomplete="off"
                 placeholder="Buscar productos, marcas o categorías…" aria-label="Buscar">
          <button class="search-close" id="search-close" aria-label="Cerrar búsqueda">✕</button>
        </div>
        <div class="search-results" id="search-results"></div>
      </div>`;
    document.body.appendChild(overlay);

    input = overlay.querySelector("#search-input");
    results = overlay.querySelector("#search-results");

    input.addEventListener("input", () => render(input.value));
    overlay.querySelector("#search-close").addEventListener("click", cerrar);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

    // Clic en un chip de marca: rellena el buscador con esa marca y re-filtra.
    results.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-marca]");
      if (chip) { input.value = chip.dataset.marca; render(input.value); input.focus(); return; }
      // Al agregar al carrito o ir a una categoría, cerramos el overlay.
      if (e.target.closest("[data-add]") || e.target.closest("a")) cerrar();
    });
  };

  /* --- Abrir / cerrar --- */
  const abrir = () => {
    if (!overlay) construir();
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    input.value = "";
    render("");
    setTimeout(() => input.focus(), 30);
  };
  const cerrar = () => {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  /* --- Datos auxiliares --- */
  const cats   = () => Store.getCategorias();
  const marcas = () => (Store.getMarcas ? Store.getMarcas() : []);
  const catName   = (id) => { const c = cats().find(c => c.id === id);   return c ? c.nombre : ""; };
  const marcaName = (id) => { const m = marcas().find(m => m.id === id); return m ? m.nombre : ""; };
  const catHref = (id) =>
    (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[id]) ||
    `categoria.html?cat=${encodeURIComponent(id)}`;

  /* --- Render de resultados --- */
  const render = (raw) => {
    const q = norm((raw || "").trim());
    if (!q) {
      results.innerHTML = `<p class="search-hint">Escribe para buscar entre productos, marcas y categorías.</p>`;
      return;
    }

    const catsMatch = cats().filter(c => norm(c.nombre).includes(q));
    const marcasMatch = marcas().filter(m => norm(m.nombre).includes(q));
    const prodsMatch = Store.getProductos().filter(p =>
      norm(p.nombre).includes(q) ||
      norm(catName(p.categoria)).includes(q) ||
      norm(marcaName(p.marca)).includes(q) ||
      norm(p.descripcion).includes(q)
    ).slice(0, 30);

    if (!catsMatch.length && !marcasMatch.length && !prodsMatch.length) {
      results.innerHTML = `<p class="search-hint">Sin resultados para “${raw.trim()}”.</p>`;
      return;
    }

    let html = "";

    if (catsMatch.length) {
      html += `<div class="search-group"><h4 class="search-group__title">Categorías</h4><div class="search-chips">`;
      html += catsMatch.map(c => `<a class="schip" href="${catHref(c.id)}">${c.nombre}</a>`).join("");
      html += `</div></div>`;
    }

    if (marcasMatch.length) {
      html += `<div class="search-group"><h4 class="search-group__title">Marcas</h4><div class="search-chips">`;
      html += marcasMatch.map(m => `<button type="button" class="schip" data-marca="${m.nombre}">${m.nombre}</button>`).join("");
      html += `</div></div>`;
    }

    if (prodsMatch.length) {
      html += `<div class="search-group"><h4 class="search-group__title">Productos</h4>`;
      html += prodsMatch.map(p => `
        <div class="sresult">
          <img class="sresult__img" src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="52" height="52">
          <div class="sresult__info">
            <span class="sresult__meta">${marcaName(p.marca) || catName(p.categoria)}</span>
            <span class="sresult__name">${p.nombre}</span>
            <span class="sresult__price">${Cart.fmt(p.precio)}</span>
          </div>
          <button class="btn btn--accent btn--xs" data-add="${p.id}" aria-label="Agregar ${p.nombre}">Agregar</button>
        </div>`).join("");
      html += `</div>`;
    }

    results.innerHTML = html;
  };

  /* --- Inyecta el botón de lupa en la navbar de la página --- */
  const initBoton = () => {
    document.querySelectorAll(".navbar__actions").forEach(actions => {
      if (actions.querySelector("[data-open-search]")) return;
      const btn = document.createElement("button");
      btn.className = "cart-btn";
      btn.setAttribute("data-open-search", "");
      btn.setAttribute("aria-label", "Buscar");
      btn.innerHTML = LUPA;
      btn.addEventListener("click", (e) => { e.preventDefault(); abrir(); });
      actions.insertBefore(btn, actions.firstChild);
    });
  };

  const init = () => {
    if (typeof Store === "undefined") return; // páginas sin catálogo (p. ej. admin)
    initBoton();
  };

  return { init, abrir, cerrar };
})();

document.addEventListener("DOMContentLoaded", () => Search.init());
