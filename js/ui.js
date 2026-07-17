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
  const tarjetaProducto = (p, i = 0) => {
    const oferta = p.precioAnterior && p.precioAnterior > p.precio;
    const dcto = oferta ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
    return `
      <article class="card reveal ${i % 2 === 0 ? "reveal--left" : "reveal--right"}" data-cat="${p.categoria}" style="--rd:${(i % 4) * 120}ms">
        ${oferta ? `<span class="card__badge">-${dcto}%</span>` : ""}
        <div class="card__media">
          <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="300" height="300">
        </div>
        <div class="card__body">
          <span class="card__cat">${nombreCategoria(p.categoria)}</span>
          <h3 class="card__title">${p.nombre}</h3>
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
        <div class="slide__media"><img src="${p.imagen}" alt="${p.nombre}" loading="lazy" width="260" height="260"></div>
        <div class="slide__info">
          <span class="slide__tag">Oferta especial</span>
          <h3 class="slide__title">${p.nombre}</h3>
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
    const cats = Store.getCategorias();
    const productos = Store.getProductos();

    // Cada tarjeta muestra un PRODUCTO representativo de la categoría
    // y enlaza a su propia página (categoria.html).
    cont.innerHTML = cats.map((c, i) => {
      const items = productos.filter(p => p.categoria === c.id);
      const prod = items[0];
      const heroFallback = (typeof HERO_POR_CATEGORIA !== "undefined" && HERO_POR_CATEGORIA[c.id]) || "assets/gym-amb2.jpg";
      // Portada elegida a mano > primer producto > imagen genérica.
      const portada = (typeof PORTADA_CATEGORIA !== "undefined" && PORTADA_CATEGORIA[c.id]);
      const img = portada || (prod ? prod.imagen : heroFallback);
      const desde = items.length ? ` · desde ${fmt(Math.min(...items.map(p => p.precio)))}` : "";
      // Página dedicada por categoría (mejor SEO); si es nueva, usa la genérica.
      const href = (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[c.id])
        || `categoria.html?cat=${encodeURIComponent(c.id)}`;
      return `
        <a class="cat reveal ${i % 2 === 0 ? "reveal--left" : "reveal--right"}" href="${href}" style="--rd:${i * 160}ms" aria-label="Ver ${c.nombre}">
          <div class="cat__media"><img src="${img}" alt="${prod ? prod.nombre : c.nombre}" loading="lazy"></div>
          <div class="cat__info">
            <h3 class="cat__name">${c.nombre}</h3>
            <p class="cat__count">${items.length} producto${items.length !== 1 ? "s" : ""}${desde}</p>
            <span class="cat__toggle">Ver categoría <span class="cat__arrow">→</span></span>
          </div>
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

  /* Punto de entrada para la home. */
  const initHome = () => {
    renderCarrusel();
    renderCategorias();
    renderProductos();
    renderTestimonios();
    renderShowcase();
    initCommon();
  };

  return { initHome, initCommon, renderProductos, tarjetaProducto };
})();
