/* =========================================================================
   producto.js  —  Ficha de producto con galería
   -------------------------------------------------------------------------
   Se llega por  producto.html?p=<slug>  (o ?id=<uuid> como respaldo).

   SEO: el sitio es estático, así que el título, la descripción, el canonical
   y los datos estructurados se arman acá con los datos reales del producto.
   Google ejecuta JavaScript al indexar, así que los lee igual.

   El formato de los títulos sigue lo que la gente REALMENTE busca según
   Search Console: "creatina monohidratada precio honduras", "proteína whey
   precio honduras", "donde comprar creatina en honduras". Por eso el título
   lleva el nombre del producto + "precio en Honduras".
   ========================================================================= */

const Producto = (() => {
  const fmt = (n) => `${CONFIG.moneda} ${Number(n).toLocaleString("es-HN")}`;
  const SITIO = "https://fitcore-hn.com";

  let prod = null;
  let imagenes = [];
  let cantidad = 1;

  /* Convierte 'assets/x.jpg' en una URL absoluta (la necesitan og: y JSON-LD). */
  const abs = (u) => !u ? "" : (/^https?:/.test(u) ? u : `${SITIO}/${String(u).replace(/^\//, "")}`);

  const nombreCategoria = (id) => {
    const c = Store.getCategorias().find(x => String(x.id) === String(id));
    return c ? c.nombre : "";
  };
  const nombreMarca = (id) => {
    const m = Store.getMarcas().find(x => String(x.id) === String(id));
    return m ? m.nombre : "";
  };
  /* La categoría tiene página propia si está en CATEGORIA_PAGES. */
  const urlCategoria = (id) =>
    (typeof CATEGORIA_PAGES !== "undefined" && CATEGORIA_PAGES[id])
      ? CATEGORIA_PAGES[id]
      : `categoria.html?cat=${encodeURIComponent(id)}`;

  /* ---------- Cabecera de la página (título, meta, canonical) ---------- */
  const meta = (sel, attr, valor) => {
    let el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      const [k, v] = sel.replace(/[\[\]"']/g, "").split("=");
      el.setAttribute(k.replace("meta", "").trim() || "name", v);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, valor);
  };

  const pintarCabecera = () => {
    const marca = nombreMarca(prod.marca);
    const cat = nombreCategoria(prod.categoria);

    // "Gold Standard 100% Whey — Precio en Honduras | FITCORE HN"
    const titulo = `${prod.nombre} — Precio en Honduras | FITCORE HN`;
    document.title = titulo;

    const desc = `${prod.nombre}${marca ? " de " + marca : ""} original en Honduras a ${fmt(prod.precio)}. ` +
      `Sellado de fábrica, con envío a todo el país y pago por transferencia. ` +
      `${cat ? cat + "." : ""}`.trim();

    meta('meta[name="description"]', "content", desc);
    meta('meta[property="og:title"]', "content", titulo);
    meta('meta[property="og:description"]', "content", desc);
    meta('meta[property="og:type"]', "content", "product");
    meta('meta[property="og:image"]', "content", abs(prod.imagen));
    meta('meta[property="og:url"]', "content", urlCanonica());
    meta('meta[name="twitter:card"]', "content", "summary_large_image");
    meta('meta[name="twitter:title"]', "content", titulo);
    meta('meta[name="twitter:description"]', "content", desc);
    meta('meta[name="twitter:image"]', "content", abs(prod.imagen));

    let can = document.head.querySelector('link[rel="canonical"]');
    if (!can) { can = document.createElement("link"); can.rel = "canonical"; document.head.appendChild(can); }
    can.href = urlCanonica();
  };

  const urlCanonica = () => `${SITIO}/producto.html?p=${encodeURIComponent(prod.slug || prod.id)}`;

  /* ---------- Datos estructurados ---------- */
  /* El bloque Product con su precio es lo que permite que Google muestre
     el precio en el resultado de búsqueda, que es justo lo que la gente
     está buscando ("... precio honduras"). */
  const inyectarJsonLd = () => {
    const marca = nombreMarca(prod.marca);
    const cat = nombreCategoria(prod.categoria);
    const fotos = imagenes.length ? imagenes.map(i => abs(i.url)) : [abs(prod.imagen)];

    const producto = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": prod.nombre,
      "image": fotos,
      "description": prod.descripcion || prod.nombre,
      "category": cat || undefined,
      "sku": prod.slug || prod.id,
      "offers": {
        "@type": "Offer",
        "url": urlCanonica(),
        "price": Number(prod.precio),
        "priceCurrency": "HNL",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "seller": { "@type": "Organization", "name": "FITCORE HN" },
        "areaServed": { "@type": "Country", "name": "Honduras" }
      }
    };
    if (marca) producto.brand = { "@type": "Brand", "name": marca };

    const migas = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": SITIO + "/" },
        { "@type": "ListItem", "position": 2, "name": cat || "Productos",
          "item": SITIO + "/" + urlCategoria(prod.categoria) },
        { "@type": "ListItem", "position": 3, "name": prod.nombre, "item": urlCanonica() }
      ]
    };

    for (const obj of [producto, migas]) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    }
  };

  /* ---------- Galería ---------- */
  const mostrarFoto = (i) => {
    const img = document.getElementById("pr-img");
    const f = imagenes[i];
    if (!f) return;
    img.src = f.url;
    img.alt = f.alt || `${prod.nombre} — imagen ${i + 1}`;
    document.querySelectorAll("#pr-miniaturas button").forEach((b, n) =>
      b.classList.toggle("is-active", n === i));
  };

  const pintarGaleria = () => {
    const cont = document.getElementById("pr-miniaturas");

    // La foto principal del producto siempre va primera; la galería suma.
    const extra = imagenes.filter(i => i.url !== prod.imagen);
    imagenes = [{ url: prod.imagen, alt: prod.nombre }, ...extra];

    mostrarFoto(0);

    // Con una sola imagen no tiene sentido mostrar miniaturas.
    if (imagenes.length < 2) { cont.hidden = true; return; }
    cont.hidden = false;
    cont.innerHTML = imagenes.map((f, i) => `
      <button type="button" class="pr-mini${i === 0 ? " is-active" : ""}" data-i="${i}"
              aria-label="Ver imagen ${i + 1} de ${imagenes.length}">
        <img src="${f.url}" alt="" loading="lazy">
      </button>`).join("");

    cont.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => mostrarFoto(Number(b.dataset.i))));
  };

  /* ---------- Ficha ---------- */
  const pintar = () => {
    const marca = nombreMarca(prod.marca);
    const cat = nombreCategoria(prod.categoria);
    const oferta = prod.precioAnterior && prod.precioAnterior > prod.precio;

    // Migas
    document.getElementById("pr-migas").innerHTML =
      `<a href="index.html">Inicio</a> <span aria-hidden="true">›</span> ` +
      (cat ? `<a href="${urlCategoria(prod.categoria)}">${cat}</a> <span aria-hidden="true">›</span> ` : "") +
      `<span aria-current="page">${prod.nombre}</span>`;

    document.getElementById("pr-nombre").textContent = prod.nombre;
    document.getElementById("pr-precio").textContent = fmt(prod.precio);
    document.getElementById("pr-desc").textContent = prod.descripcion || "";

    if (oferta) {
      const dcto = Math.round((1 - prod.precio / prod.precioAnterior) * 100);
      const old = document.getElementById("pr-precio-old");
      old.textContent = fmt(prod.precioAnterior); old.hidden = false;
      const d = document.getElementById("pr-dcto");
      d.textContent = `-${dcto}%`; d.hidden = false;
      const b = document.getElementById("pr-badge");
      b.textContent = `-${dcto}%`; b.hidden = false;
    }

    if (marca) {
      const m = document.getElementById("pr-marca");
      m.textContent = marca; m.hidden = false;
      m.href = `index.html#productos`;
      document.getElementById("pr-meta-marca").hidden = false;
      document.getElementById("pr-cat-marca").textContent = marca;
    }
    document.getElementById("pr-cat").innerHTML = cat
      ? `<a href="${urlCategoria(prod.categoria)}">${cat}</a>` : "—";

    // WhatsApp con el producto ya mencionado
    const msg = `Hola ${CONFIG.marca}! Me interesa: ${prod.nombre} (${fmt(prod.precio)}).`;
    document.getElementById("pr-wa").href =
      `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

    // Compartir
    const url = urlCanonica();
    document.getElementById("pr-sh-wa").href =
      `https://wa.me/?text=${encodeURIComponent(prod.nombre + " — " + fmt(prod.precio) + " " + url)}`;
    document.getElementById("pr-sh-fb").href =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

    pintarGaleria();
  };

  /* ---------- Relacionados ---------- */
  const pintarRelacionados = () => {
    const cat = nombreCategoria(prod.categoria);
    const lista = Store.getProductos()
      .filter(p => p.categoria === prod.categoria && String(p.id) !== String(prod.id))
      .slice(0, 4);
    if (!lista.length) return;

    document.getElementById("pr-rel-titulo").textContent =
      cat ? `Más en ${cat}` : "Productos relacionados";
    document.getElementById("pr-rel-grid").innerHTML =
      lista.map((p, i) => UI.tarjetaProducto(p, i)).join("");
    document.getElementById("pr-relacionados").hidden = false;
  };

  /* ---------- Cantidad y carrito ---------- */
  const initCompra = () => {
    const num = document.getElementById("pr-cant");
    const set = (n) => { cantidad = Math.min(99, Math.max(1, n)); num.textContent = cantidad; };
    document.getElementById("pr-menos").addEventListener("click", () => set(cantidad - 1));
    document.getElementById("pr-mas").addEventListener("click", () => set(cantidad + 1));
    document.getElementById("pr-add").addEventListener("click", () => {
      Cart.agregar(prod.id, cantidad);
      set(1);
    });

    document.getElementById("pr-sh-link").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(urlCanonica());
        const b = e.currentTarget;
        b.textContent = "¡Copiado!";
        setTimeout(() => (b.textContent = "Copiar enlace"), 1800);
      } catch (err) { /* sin portapapeles: copia la URL a mano */ }
    });
  };

  /* ---------- Carga ---------- */
  const noExiste = () => {
    document.getElementById("pr-cargando").hidden = true;
    document.getElementById("pr-noexiste").hidden = false;
    document.title = "Producto no encontrado | FITCORE HN";
  };

  const init = async () => {
    const q = new URLSearchParams(location.search);
    const slug = q.get("p");
    const id = q.get("id");
    if (!slug && !id) { noExiste(); return; }

    // El catálogo ya está en memoria (store.js); buscamos ahí primero.
    prod = Store.getProductos().find(p =>
      (slug && String(p.slug) === slug) || (id && String(p.id) === id));

    if (!prod) { noExiste(); return; }

    // Las imágenes extra sí hay que pedirlas: no vienen con el catálogo.
    try {
      const { data } = await sb.from("producto_imagenes")
        .select("url, alt, orden").eq("producto_id", prod.id)
        .order("orden", { ascending: true });
      imagenes = data || [];
    } catch (e) { imagenes = []; }

    document.getElementById("pr-cargando").hidden = true;
    document.getElementById("pr-contenido").hidden = false;

    pintar();
    pintarCabecera();
    inyectarJsonLd();
    pintarRelacionados();
    initCompra();
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Store !== "undefined" && Store.ready && Store.ready.then) {
    Store.ready.then(Producto.init);
  } else {
    Producto.init();
  }
});
