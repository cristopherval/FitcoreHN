/* =========================================================================
   checkout.js  —  Página de finalizar compra
   -------------------------------------------------------------------------
   Arma el resumen del carrito, carga las zonas de envío desde Supabase y
   crea el pedido llamando a la función crear_pedido().

   IMPORTANTE: acá NO se calcula el precio que se va a cobrar. Los totales
   que se muestran son solo informativos; el total real lo calcula Supabase
   leyendo los precios de la base. Si alguien edita este archivo en su
   navegador, lo único que logra es ver un número equivocado en pantalla.
   ========================================================================= */

const Checkout = (() => {
  const fmt = (n) => `${CONFIG.moneda} ${Number(n).toLocaleString("es-HN")}`;

  let zonas = [];

  /* Mensajes claros para los errores que devuelve la base de datos. */
  const ERRORES = {
    NOMBRE_INVALIDO:     "Escribí tu nombre completo (al menos 3 letras).",
    TELEFONO_INVALIDO:   "Revisá el teléfono: necesitamos al menos 8 dígitos.",
    DIRECCION_INVALIDA:  "Necesitamos una dirección más específica para poder llegar.",
    ZONA_SIN_COBERTURA:  "Esa zona de entrega ya no está disponible. Elegí otra.",
    CARRITO_VACIO:       "Tu carrito está vacío.",
    CANTIDAD_INVALIDA:   "Hay una cantidad inválida en el carrito.",
    PRODUCTO_NO_EXISTE:  "Uno de los productos ya no está disponible. Vaciá el carrito y volvé a armarlo.",
    DEMASIADOS_ITEMS:    "El pedido tiene demasiados productos distintos. Escribinos por WhatsApp.",
    METODO_INVALIDO:     "Forma de pago no válida."
  };

  const traducirError = (msg) => {
    if (!msg) return "No pudimos registrar tu pedido. Intentá de nuevo.";
    const clave = Object.keys(ERRORES).find(k => msg.includes(k));
    return clave ? ERRORES[clave] : "No pudimos registrar tu pedido. Revisá tu conexión e intentá de nuevo.";
  };

  /* ---------- Resumen del pedido ---------- */
  const lineas = () => Store.getCarrito().map(item => {
    const p = Store.getProducto(item.id);
    if (!p) return null;
    return { ...p, cantidad: item.cantidad, subtotal: p.precio * item.cantidad };
  }).filter(Boolean);

  const subtotal = () => lineas().reduce((a, l) => a + l.subtotal, 0);

  const zonaSeleccionada = () => {
    const id = document.getElementById("co-zona").value;
    return zonas.find(z => z.id === id) || null;
  };

  const pintarResumen = () => {
    const els = lineas();
    document.getElementById("co-lineas").innerHTML = els.map(l => `
      <div class="co-linea">
        <img src="${l.imagen}" alt="${l.nombre}" width="48" height="48" loading="lazy">
        <div class="co-linea__info">
          <span class="co-linea__nombre">${l.nombre}</span>
          <span class="co-linea__cant">${l.cantidad} × ${fmt(l.precio)}</span>
        </div>
        <span class="co-linea__sub">${fmt(l.subtotal)}</span>
      </div>`).join("");

    const sub = subtotal();
    const zona = zonaSeleccionada();
    document.getElementById("co-subtotal").textContent = fmt(sub);

    if (!zona) {
      document.getElementById("co-envio").textContent = "—";
      document.getElementById("co-total").textContent = fmt(sub);
      return;
    }
    document.getElementById("co-envio").textContent =
      Number(zona.costo) === 0 ? "Gratis" : fmt(zona.costo);
    document.getElementById("co-total").textContent = fmt(sub + Number(zona.costo));
  };

  /* ---------- Zonas de envío ---------- */
  const cargarZonas = async () => {
    const sel = document.getElementById("co-zona");
    const { data, error } = await sb
      .from("zonas_envio").select("*").eq("activo", true)
      .order("orden", { ascending: true });

    if (error || !data || !data.length) {
      sel.innerHTML = `<option value="">No se pudieron cargar las zonas</option>`;
      mostrarError("No pudimos cargar las opciones de entrega. Recargá la página o escribinos por WhatsApp.");
      return;
    }
    zonas = data;
    sel.innerHTML = `<option value="">Elegí una opción…</option>` +
      zonas.map(z => {
        const costo = Number(z.costo) === 0 ? "Gratis" : fmt(z.costo);
        return `<option value="${z.id}">${z.nombre} — ${costo}</option>`;
      }).join("");
  };

  /* Un punto de retiro (UNAH CU) no necesita dirección de casa. */
  const ajustarDireccion = () => {
    const zona = zonaSeleccionada();
    const row = document.getElementById("co-dir-row");
    const campo = document.getElementById("co-dir");
    // Sin zona elegida todavía, mostramos el campo por defecto.
    const pide = zona ? zona.pide_direccion : true;
    row.hidden = !pide;
    campo.required = pide;
    if (!pide) campo.value = "";
  };

  /* ---------- Errores en pantalla ---------- */
  const mostrarError = (txt) => {
    const el = document.getElementById("co-error");
    el.textContent = txt;
    el.classList.toggle("is-visible", !!txt);
    if (txt) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ---------- Guardar el token del pedido en este navegador ---------- */
  /* Así el cliente puede volver a su pedido si cierra la pestaña. */
  const recordarPedido = (token, numero) => {
    try {
      const previos = JSON.parse(localStorage.getItem(STORAGE_KEYS.pedidos) || "[]");
      previos.unshift({ token, numero, fecha: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEYS.pedidos, JSON.stringify(previos.slice(0, 20)));
    } catch (e) { /* si el navegador bloquea storage, no es crítico */ }
  };

  /* ---------- Enviar el pedido ---------- */
  const enviar = async (e) => {
    e.preventDefault();
    mostrarError("");

    const items = Store.getCarrito()
      .map(i => ({ id: String(i.id), cantidad: Number(i.cantidad) }))
      .filter(i => i.cantidad > 0);

    if (!items.length) { mostrarError(ERRORES.CARRITO_VACIO); return; }

    const zona = zonaSeleccionada();
    if (!zona) { mostrarError("Elegí dónde querés recibir tu pedido."); return; }

    const btn = document.getElementById("co-submit");
    btn.disabled = true;
    btn.textContent = "Registrando pedido…";

    const { data, error } = await sb.rpc("crear_pedido", {
      p_items:     items,
      p_nombre:    document.getElementById("co-nombre").value,
      p_telefono:  document.getElementById("co-tel").value,
      p_zona:      zona.id,
      p_direccion: document.getElementById("co-dir").value,
      p_notas:     document.getElementById("co-notas").value,
      p_metodo:    document.querySelector('input[name="metodo"]:checked').value
    });

    btn.disabled = false;
    btn.textContent = "Confirmar pedido";

    if (error) { mostrarError(traducirError(error.message)); return; }

    // Pedido creado: vaciamos el carrito y vamos a la página del pedido,
    // que es donde se paga y se sube el voucher.
    recordarPedido(data.token, data.numero);
    Store.setCarrito([]);
    window.location.href = `pedido.html?t=${encodeURIComponent(data.token)}`;
  };

  /* ---------- Arranque ---------- */
  const init = async () => {
    // Si no hay nada en el carrito, no tiene sentido mostrar el formulario.
    if (!Store.getCarrito().length) {
      document.getElementById("co-vacio").hidden = false;
      return;
    }
    document.getElementById("co-contenido").hidden = false;

    // La opción de tarjeta aparece sola cuando la activás en data.js.
    if (typeof PAGOS !== "undefined" && PAGOS.tarjetaActiva) {
      const t = document.getElementById("co-pago-tarjeta");
      t.hidden = false;
      t.classList.remove("is-disabled");
      t.querySelector("input").disabled = false;
      t.querySelector("small").textContent = "Pagá en línea con Visa, Mastercard o American Express.";
    }
    if (typeof PAGOS !== "undefined" && PAGOS.transferenciaActiva === false) {
      const tr = document.getElementById("co-pago-transfer");
      tr.hidden = true;
      tr.querySelector("input").checked = false;
      document.querySelector('input[name="metodo"][value="whatsapp"]').checked = true;
    }

    await cargarZonas();
    pintarResumen();

    document.getElementById("co-zona").addEventListener("change", () => {
      ajustarDireccion();
      pintarResumen();
    });
    document.getElementById("co-form").addEventListener("submit", enviar);
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => {
  // Esperamos el catálogo: el resumen necesita nombres y precios.
  if (typeof Store !== "undefined" && Store.ready && Store.ready.then) {
    Store.ready.then(Checkout.init);
  } else {
    Checkout.init();
  }
});
