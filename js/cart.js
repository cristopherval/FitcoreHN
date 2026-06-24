/* =========================================================================
   cart.js  —  Carrito de compras + checkout por WhatsApp
   -------------------------------------------------------------------------
   El carrito se renderiza como un panel lateral (drawer). El estado vive en
   localStorage vía Store, así persiste entre páginas (index, contacto...).
   El checkout arma un mensaje y abre wa.me con el detalle del pedido.
   ========================================================================= */

const Cart = (() => {
  /* Da formato a un precio en Lempiras. */
  const fmt = (n) => `${CONFIG.moneda} ${Number(n).toLocaleString("es-HN")}`;

  /* Añade un producto (o suma cantidad si ya existe). */
  const agregar = (idProducto, cantidad = 1) => {
    const prod = Store.getProducto(idProducto);
    if (!prod) return;
    const carrito = Store.getCarrito();
    const existente = carrito.find(i => i.id === idProducto);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      carrito.push({ id: idProducto, cantidad });
    }
    Store.setCarrito(carrito);
    render();
    abrir();
    pulso();
  };

  /* Cambia la cantidad; si llega a 0 se elimina. */
  const cambiarCantidad = (idProducto, delta) => {
    const carrito = Store.getCarrito();
    const item = carrito.find(i => i.id === idProducto);
    if (!item) return;
    item.cantidad += delta;
    const limpio = carrito.filter(i => i.cantidad > 0);
    Store.setCarrito(limpio);
    render();
  };

  // Eliminar exige confirmación (modal) para evitar borrados accidentales.
  const eliminar = async (idProducto) => {
    const prod = Store.getProducto(idProducto);
    const nombre = prod ? prod.nombre : "este producto";
    const ok = await Confirm.show("Eliminar del carrito",
      `¿Quitar "${nombre}" de tu carrito?`, "Sí, eliminar");
    if (!ok) return;
    Store.setCarrito(Store.getCarrito().filter(i => i.id !== idProducto));
    render();
  };

  const vaciar = async () => {
    if (Store.getCarrito().length === 0) return;
    const ok = await Confirm.show("Vaciar carrito",
      "Se quitarán todos los productos de tu carrito. ¿Continuar?", "Sí, vaciar");
    if (!ok) return;
    Store.setCarrito([]);
    render();
  };

  /* Devuelve líneas enriquecidas con datos del producto + subtotal. */
  const lineas = () => {
    return Store.getCarrito().map(item => {
      const prod = Store.getProducto(item.id);
      if (!prod) return null;
      return { ...prod, cantidad: item.cantidad, subtotal: prod.precio * item.cantidad };
    }).filter(Boolean);
  };

  const total = () => lineas().reduce((acc, l) => acc + l.subtotal, 0);
  const conteo = () => Store.getCarrito().reduce((acc, i) => acc + i.cantidad, 0);

  /* --- Render del drawer y de los contadores --- */
  const render = () => {
    const cont = document.getElementById("cart-items");
    const els = lineas();

    // Actualiza todos los badges de conteo (navbar superior + barra inferior).
    document.querySelectorAll("[data-cart-count]").forEach(b => {
      const c = conteo();
      b.textContent = c;
      b.classList.toggle("is-empty", c === 0);
    });

    if (!cont) return; // páginas sin drawer (por si acaso)

    if (els.length === 0) {
      cont.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty__icon" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.2 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/></svg></span>
          <p>Tu carrito está vacío.</p>
          <span class="cart-empty__hint">Agrega productos para armar tu pedido.</span>
        </div>`;
    } else {
      cont.innerHTML = els.map(l => `
        <article class="cart-item" data-id="${l.id}">
          <img class="cart-item__img" src="${l.imagen}" alt="${l.nombre}" loading="lazy" width="64" height="64">
          <div class="cart-item__info">
            <h4 class="cart-item__name">${l.nombre}</h4>
            <span class="cart-item__price">${fmt(l.precio)}</span>
            <div class="qty">
              <button class="qty__btn" data-action="dec" aria-label="Quitar uno">−</button>
              <span class="qty__num" aria-live="polite">${l.cantidad}</span>
              <button class="qty__btn" data-action="inc" aria-label="Agregar uno">+</button>
            </div>
          </div>
          <div class="cart-item__right">
            <span class="cart-item__subtotal">${fmt(l.subtotal)}</span>
            <button class="cart-item__remove" data-action="remove" aria-label="Eliminar producto">Eliminar</button>
          </div>
        </article>`).join("");
    }

    const totalEl = document.getElementById("cart-total");
    if (totalEl) totalEl.textContent = fmt(total());

    const checkoutBtn = document.getElementById("cart-checkout");
    if (checkoutBtn) checkoutBtn.disabled = els.length === 0;
  };

  /* --- Abrir / cerrar drawer --- */
  const abrir = () => {
    document.getElementById("cart-drawer")?.classList.add("is-open");
    document.getElementById("overlay")?.classList.add("is-visible");
    document.body.style.overflow = "hidden";
  };
  const cerrar = () => {
    document.getElementById("cart-drawer")?.classList.remove("is-open");
    document.getElementById("overlay")?.classList.remove("is-visible");
    document.body.style.overflow = "";
  };

  /* Pequeña animación de "latido" en los íconos del carrito al agregar. */
  const pulso = () => {
    document.querySelectorAll("[data-cart-icon]").forEach(el => {
      el.classList.remove("pulse");
      // Forzar reflow para reiniciar la animación.
      void el.offsetWidth;
      el.classList.add("pulse");
    });
  };

  /* --- Checkout: arma el mensaje y abre WhatsApp --- */
  const checkout = () => {
    const els = lineas();
    if (els.length === 0) return;

    let msg = `*¡Hola ${CONFIG.marca}!* 🏋️\nQuiero realizar el siguiente pedido:\n\n`;
    els.forEach((l, i) => {
      msg += `${i + 1}. ${l.nombre}\n   ${l.cantidad} x ${fmt(l.precio)} = ${fmt(l.subtotal)}\n`;
    });
    msg += `\n*TOTAL: ${fmt(total())}*\n\n`;
    msg += `Por favor confírmenme disponibilidad y forma de entrega. ¡Gracias!`;

    const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  /* Conecta los listeners del drawer (delegación de eventos). */
  const initEventos = () => {
    // Acciones dentro de cada item del carrito.
    document.getElementById("cart-items")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.closest(".cart-item")?.dataset.id;
      if (!id) return;
      const action = btn.dataset.action;
      if (action === "inc") cambiarCantidad(id, 1);
      if (action === "dec") cambiarCantidad(id, -1);
      if (action === "remove") eliminar(id);
    });

    document.getElementById("cart-checkout")?.addEventListener("click", checkout);
    document.getElementById("cart-clear")?.addEventListener("click", vaciar);
    document.getElementById("cart-close")?.addEventListener("click", cerrar);
    document.getElementById("overlay")?.addEventListener("click", cerrar);

    // Abrir el carrito desde cualquier botón con [data-open-cart].
    document.querySelectorAll("[data-open-cart]").forEach(b =>
      b.addEventListener("click", (e) => { e.preventDefault(); abrir(); })
    );

    // Cerrar con Escape.
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

    render();
  };

  return { agregar, cambiarCantidad, eliminar, vaciar, checkout, abrir, cerrar, render, initEventos, fmt, conteo };
})();
