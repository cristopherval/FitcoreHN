/* =========================================================================
   ui.js  —  Renderizado de la página de inicio
   -------------------------------------------------------------------------
   Construye dinámicamente: carrusel de ofertas, bloques de categorías
   (expandibles), grilla de productos con filtro, y testimonios.
   Todo se alimenta del Store, así el panel admin actualiza la vitrina.
   ========================================================================= */

const UI = (() => {
  const fmt = Cart.fmt;

  /* Crea el HTML de una tarjeta de producto reutilizable. */
  /* URL de la ficha del producto. Usa el slug si existe (mejor para SEO:
     las palabras de la URL cuentan) y cae al id si todavia no lo tiene. */
  const urlProducto = (p) =>
    p.slug ? `producto.html?p=${encodeURIComponent(p.slug)}`
           : `producto.html?id=${encodeURIComponent(p.id)}`;

  const tarjetaProducto = (p, i = 0) => {
    const oferta = p.precioAnterior && p.precioAnterior > p.precio;
    const dcto = oferta ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
    return `
      <article class="card reveal ${i % 2 === 0 ? "reveal--left" : "reveal--right"}" data-cat="${p.categoria}" style="--rd:${(i % 4) * 120}ms">
        ${oferta ? `<span class="card__badge">-${dcto}%</span>` : ""}
        <a class="card__media" href="${urlProducto(p)}" aria-label="Ver ${p.nombre}">
          <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="300" height="300">
        </a>
        <div class="card__body">
          <span class="card__cat">${nombreMarca(p.marca) || nombreCategoria(p.categoria)}</span>
          <h3 class="card__title"><a href="${urlProducto(p)}">${p.nombre}</a></h3>
          <p class="card__desc">${p.descripcion}</p>
          <div class="card__footer">
            <div class="card__prices">
              <span class="card__price">${fmt(p.precio)}</span>
              ${oferta ? `<span class="card__price--old">${fmt(p.precioAnterior)}</span>` : ""}
            </div>
            <button class="btn btn--accent btn--sm" data-add="${p.id}" aria-label="Agregar ${p.nombre} al carrito">
              Agregar
            </button>
          </div>
        </div>
      </article>`;
  };

  const nombreCategoria = (id) => {
    const c = Store.getCategorias().find(c => c.id === id);
    return c ? c.nombre : "General";
  };

  const nombreMarca = (id) => {
    if (!id || !Store.getMarcas) return "";
    const m = Store.getMarcas().find(m => m.id === id);
    return m ? m.nombre : "";
  };

  /* --- Carrusel de ofertas ---
     Muestra los productos marcados como "Ofertas de la semana" en el panel.
     Si ninguno está marcado, cae en los que tienen precio promo. */
  const renderCarrusel = () => {
    const track = document.getElementById("carousel-track");
    if (!track) return;
    const todos = Store.getProductos();
    let lista = todos.filter(p => p.enOfertas);
    if (!lista.length) lista = todos.filter(p => p.precioAnterior && p.precioAnterior > p.precio);
    if (!lista.length) lista = todos.filter(p => p.destacado);

    track.innerHTML = lista.map(p => `
      <div class="slide">
        <a class="slide__media" href="${urlProducto(p)}" aria-label="Ver ${p.nombre}"><img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="260" height="260"></a>
        <div class="slide__info">
          <span class="slide__tag">Oferta especial</span>
          <h3 class="slide__title"><a href="${urlProducto(p)}">${p.nombre}</a></h3>
          <p class="slide__desc">${p.descripcion}</p>
          <div class="slide__prices">
            <span class="slide__price">${fmt(p.precio)}</span>
            ${p.precioAnterior ? `<span class="slide__old">${fmt(p.precioAnterior)}</span>` : ""}
          </div>
          <button class="btn btn--accent" data-add="${p.id}">Aprovechar oferta</button>
        </div>
      </div>`).join("");

    initCarruselNav(lista.length);
  };

  /* Navegación del carrusel con flechas (desplazamiento por slide). */
  const initCarruselNav = (n) => {
    const track = document.getElementById("carousel-track");
    const prev = document.getElementById("carousel-prev");
    const next = document.getElementById("carousel-next");
    if (!track || !prev || !next) return;

    const irA = (dir) => {
      const slide = track.querySelector(".slide");
      if (!slide) return;
      const ancho = slide.getBoundingClientRect().width + 20; // + gap
      const max = track.scrollWidth - track.clientWidth;  // desplazamiento máximo
      const pos = track.scrollLeft;
      let destino = pos + dir * ancho;
      // Carrusel continuo: al pasar del final vuelve al inicio (y viceversa).
      if (dir > 0 && pos >= max - 5) destino = 0;
      else if (dir < 0 && pos <= 5) destino = max;
      track.scrollTo({ left: destino, behavior: "smooth" });
    };
    prev.onclick = () => irA(-1);
    next.onclick = () => irA(1);
  };

  /* --- Categorías: cada tarjeta ENLAZA a su propia página (categoria.html) --- */
  const renderCategorias = () => {
    const cont = document.getElementById("categorias-grid");
    if (!cont) return;
    // El mosaico muestra TODAS las categorías, en el orden de la base. Al
    // pasar de foto grande a icono ocupan poco, así que ya no hace falta
    // esconder ninguna.
    const cats = Store.getCategorias();

    // Cada tarjeta es solo el icono y el nombre: es un acceso, no una ficha.
    // El conteo y el precio se quitaron para que se lea de un vistazo.
    cont.innerHTML = cats.map((c, i) => {
      // Página dedicada por categoría (mejor SEO); si es nueva, la genérica.
      const href = (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[c.id])
        || `categoria.html?cat=${encodeURIComponent(c.id)}`;
      // El icono lo eliges en el panel. Si la biblioteca no cargara, se
      // omite y la tarjeta sigue funcionando.
      const ico = (typeof iconoSVG === "function") ? iconoSVG(c.icono, 34) : "";
      return `
        <a class="cat reveal ${i % 2 === 0 ? "reveal--left" : "reveal--right"}" href="${href}" style="--rd:${i * 160}ms" aria-label="Ver ${c.nombre}">
          <span class="cat__icono">${ico}</span>
          <h3 class="cat__name">${c.nombre}</h3>
        </a>`;
    }).join("");
    revelarVisibles();
  };

  /* Showcase tipo "3D" junto a los testimonios. */
  const renderShowcase = () => {
    const img = document.getElementById("showcase-img");
    if (img && typeof SHOWCASE !== "undefined") img.src = SHOWCASE.imagen;
  };

  /* --- "Nuestros más vendidos": muestra 4 productos destacados ---
     Prioriza los marcados como destacados y completa hasta 4 con el resto,
     de modo que la fila siempre quede pareja (sin un producto suelto). */
  const renderProductos = () => {
    const cont = document.getElementById("productos-grid");
    if (!cont) return;
    const todos = Store.getProductos();
    const destacados = todos.filter(p => p.destacado);
    const resto = todos.filter(p => !p.destacado);
    // Prioriza los destacados y completa hasta 4 con el resto.
    const lista = [...destacados, ...resto].slice(0, 4);

    cont.innerHTML = lista.length
      ? lista.map((p, i) => tarjetaProducto(p, i)).join("")
      : `<p class="muted">Aún no hay productos. Agrégalos desde el panel de administración.</p>`;
    revelarVisibles();
  };

  /* --- Testimonios --- */
  const renderTestimonios = () => {
    const cont = document.getElementById("testimonios-grid");
    if (!cont) return;
    cont.innerHTML = Store.getTestimonios().map((t, i) => `
      <blockquote class="testi reveal ${i % 2 === 0 ? "reveal--left" : "reveal--right"}" style="--rd:${i * 160}ms">
        <div class="testi__stars" aria-label="${t.estrellas} de 5 estrellas">${"★".repeat(t.estrellas)}</div>
        <p class="testi__text">"${t.texto}"</p>
        <footer class="testi__author">
          <strong>${t.nombre}</strong>
          <span>${t.ciudad}</span>
        </footer>
      </blockquote>`).join("");
    revelarVisibles();
  };

  /* --- Animación de aparición al hacer scroll (IntersectionObserver) --- */
  let observer;
  const initReveal = () => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
      return;
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revelarVisibles();
  };
  const revelarVisibles = () => {
    if (!observer) return;
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(el => observer.observe(el));
  };

  /* Delegación global: cualquier botón [data-add] agrega al carrito.
     Guardado con bandera para no registrarlo dos veces. */
  let _agregarListo = false;
  const initAgregar = () => {
    if (_agregarListo) return;
    _agregarListo = true;
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      Cart.agregar(btn.dataset.add, 1);
    });
  };

  /* Inicialización compartida por TODAS las páginas (reveal + agregar). */
  const initCommon = () => {
    initReveal();
    initAgregar();
  };

  /* --- Datos estructurados Product/ItemList (SEO: resultados enriquecidos) ---
     Se generan desde el catálogo real y se inyectan en el <head>. */
  let _jsonLdDone = false;
  const absUrl = (u) => !u ? undefined : (/^https?:/.test(u) ? u : `${location.origin}/${String(u).replace(/^\//, "")}`);
  const injectProductsJsonLd = (productos, listName) => {
    if (_jsonLdDone || !productos || !productos.length) return;
    _jsonLdDone = true;
    const items = productos.map((p, i) => {
      const item = {
        "@type": "Product",
        "name": p.nombre,
        // La url deja que Google descubra e indexe la ficha de cada producto.
        "url": absUrl(urlProducto(p)),
        "image": absUrl(p.imagen),
        "category": nombreCategoria(p.categoria),
        "offers": {
          "@type": "Offer",
          "price": p.precio,
          "priceCurrency": "HNL",
          "availability": "https://schema.org/InStock"
        }
      };
      if (p.descripcion) item.description = p.descripcion;
      const marca = nombreMarca(p.marca);
      if (marca) item.brand = { "@type": "Brand", "name": marca };
      return { "@type": "ListItem", "position": i + 1, "item": item };
    });
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "ItemList",
      "name": listName, "itemListElement": items
    });
    document.head.appendChild(s);
  };

  /* Punto de entrada para la home. */
  const initHome = () => {
    renderCarrusel();
    renderCategorias();
    renderProductos();
    renderTestimonios();
    renderShowcase();
    initCommon();
    injectProductsJsonLd(Store.getProductos(), "Catálogo FITCORE HN");
  };

  return { initHome, initCommon, renderProductos, tarjetaProducto, urlProducto, injectProductsJsonLd };
})();
