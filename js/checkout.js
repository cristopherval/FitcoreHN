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
    NOMBRE_INVALIDO:     "Escribí tu nombre (al menos 2 letras).",
    APELLIDO_INVALIDO:   "Escribí tu primer apellido.",
    TELEFONO_INVALIDO:   "Revisá el teléfono: necesitamos al menos 8 dígitos.",
    DIRECCION_INVALIDA:  "Necesitamos una dirección más específica para poder llegar.",
    ZONA_SIN_COBERTURA:  "Esa zona de entrega ya no está disponible. Elegí otra.",
    DESTINATARIO_TELEFONO_INVALIDO: "Revisá el teléfono de quien recibe el pedido.",
    DESTINATARIO_INVALIDO: "Escribí el nombre de quien recibe el pedido.",
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
    const r = document.querySelector('input[name="zona"]:checked');
    return r ? (zonas.find(z => z.id === r.value) || null) : null;
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
  /* Van como radios (no lista desplegable) para que el cliente compare
     todos los precios de un vistazo antes de decidir. */
  const cargarZonas = async () => {
    const cont = document.getElementById("co-zonas");
    const { data, error } = await sb
      .from("zonas_envio").select("*").eq("activo", true)
      .order("orden", { ascending: true });

    if (error || !data || !data.length) {
      cont.innerHTML = `<p class="muted">No se pudieron cargar las opciones de entrega.</p>`;
      mostrarError("No pudimos cargar las opciones de entrega. Recargá la página o escribinos por WhatsApp.");
      return;
    }

    zonas = data;
    cont.innerHTML = zonas.map(z => `
      <label class="co-zona">
        <input type="radio" name="zona" value="${z.id}">
        <span class="co-zona__body">
          <span class="co-zona__fila">
            <strong>${z.nombre}</strong>
            <span class="co-zona__precio">${Number(z.costo) === 0 ? "Gratis" : fmt(z.costo)}</span>
          </span>
          ${z.descripcion ? `<small>${z.descripcion}</small>` : ""}
        </span>
      </label>`).join("");

    cont.querySelectorAll('input[name="zona"]').forEach(r =>
      r.addEventListener("change", () => { ajustarCampos(); pintarResumen(); }));
  };

  /* Según la zona: un punto de retiro no necesita dirección pero sí
     identidad (hay que verificar quién recoge); un envío, al revés. */
  const ajustarCampos = () => {
    const zona = zonaSeleccionada();

    const pideDir = zona ? zona.pide_direccion : true;
    document.getElementById("co-dir-row").hidden = !pideDir;
    const dir = document.getElementById("co-dir");
    dir.required = pideDir;
    if (!pideDir) dir.value = "";

    // El campo se MUESTRA en puntos de retiro, pero nunca es obligatorio:
    // que a alguien le falte la identidad a mano no debe costarnos la venta.
    const muestraId = zona ? !!zona.pide_identidad : false;
    document.getElementById("co-ident-row").hidden = !muestraId;
    const ident = document.getElementById("co-ident");
    if (!muestraId) ident.value = "";

    // Mandarlo a otra persona solo tiene sentido si hay envío a domicilio.
    const filaOtro = document.getElementById("co-otro-check-row");
    filaOtro.hidden = !pideDir;
    if (!pideDir) {
      document.getElementById("co-otro").checked = false;
      ajustarOtro();
    }
  };

  /* Campos del destinatario cuando lo recibe otra persona. */
  const ajustarOtro = () => {
    const activo = document.getElementById("co-otro").checked;
    document.getElementById("co-otro-campos").hidden = !activo;
    document.getElementById("co-dest-nombre").required = activo;
    document.getElementById("co-dest-tel").required = activo;
    if (!activo) {
      document.getElementById("co-dest-nombre").value = "";
      document.getElementById("co-dest-tel").value = "";
    }
  };

  /* ---------- Teléfono: 8 dígitos con guion automático ---------- */
  /* El +504 va fijo al lado del campo, así que acá solo viven los 8
     dígitos locales. Al pasar el cuarto se inserta el guion solo. */
  const soloDigitos = (txt) => {
    let d = String(txt || "").replace(/\D/g, "");
    // Si pegaron el número completo (+504 9999-9999), quitamos el país.
    if (d.length === 11 && d.startsWith("504")) d = d.slice(3);
    return d.slice(0, 8);
  };

  const formatearTel = (input) => {
    const alFinal = input.selectionStart === input.value.length;
    const d = soloDigitos(input.value);
    input.value = d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
    // Si estaba escribiendo al final, dejamos el cursor ahí.
    if (alFinal) input.setSelectionRange(input.value.length, input.value.length);
  };

  const initTelefonos = () => {
    document.querySelectorAll("[data-tel]").forEach(inp => {
      inp.addEventListener("input", () => formatearTel(inp));
      inp.addEventListener("paste", () => setTimeout(() => formatearTel(inp), 0));
    });
  };

  /* Lo que se guarda en la base: número completo y sin ambigüedad.
     Si está incompleto no inventamos el guion; que lo rechace la
     validación en vez de guardar algo a medias. */
  const telCompleto = (input) => {
    const d = soloDigitos(input.value);
    if (!d) return "";
    return d.length > 4 ? `+504 ${d.slice(0, 4)}-${d.slice(4)}` : `+504 ${d}`;
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

    const otro = document.getElementById("co-otro").checked;

    const { data, error } = await sb.rpc("crear_pedido", {
      p_items:         items,
      p_nombres:       document.getElementById("co-nombres").value,
      p_apellido1:     document.getElementById("co-ape1").value,
      p_apellido2:     document.getElementById("co-ape2").value,
      p_telefono:      telCompleto(document.getElementById("co-tel")),
      p_zona:          zona.id,
      p_identidad:     document.getElementById("co-ident").value,
      p_direccion:     document.getElementById("co-dir").value,
      p_notas:         document.getElementById("co-notas").value,
      p_metodo:        document.querySelector('input[name="metodo"]:checked').value,
      p_envio_a_otro:  otro,
      p_dest_nombre:   otro ? document.getElementById("co-dest-nombre").value : null,
      p_dest_telefono: otro ? telCompleto(document.getElementById("co-dest-tel")) : null
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
    ajustarCampos();
    pintarResumen();
    initTelefonos();

    document.getElementById("co-otro").addEventListener("change", ajustarOtro);
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
