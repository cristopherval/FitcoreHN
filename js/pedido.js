/* =========================================================================
   pedido.js  —  Página del pedido: pago por transferencia y seguimiento
   -------------------------------------------------------------------------
   El cliente llega acá con ?t=<token>. El token es un UUID aleatorio que
   solo él tiene: hace de "llave" de su pedido, sin necesidad de registrarse.

   Flujo: ve el monto y la cuenta → transfiere → sube la foto del voucher →
   el pedido pasa a "en verificación" → vos lo aprobás desde el panel.
   ========================================================================= */

const Pedido = (() => {
  const fmt = (n) => `${CONFIG.moneda} ${Number(n).toLocaleString("es-HN")}`;
  const MAX_BYTES = 5 * 1024 * 1024;   // igual que el límite del bucket

  let token = null;
  let pedido = null;
  let archivo = null;

  /* Cómo se presenta cada estado al cliente. */
  const ESTADOS = {
    pendiente_pago: {
      etiqueta: "Esperando tu pago",
      clase: "is-pendiente",
      aviso: "Tu pedido está reservado. Hacé la transferencia por el monto exacto y subí el comprobante para que lo verifiquemos."
    },
    en_verificacion: {
      etiqueta: "Verificando tu pago",
      clase: "is-verificando",
      aviso: "Recibimos tu comprobante. Lo estamos revisando y te confirmamos por WhatsApp."
    },
    verificado: {
      etiqueta: "Pago confirmado",
      clase: "is-ok",
      aviso: "¡Listo! Confirmamos tu pago. Nos pondremos en contacto para coordinar la entrega."
    },
    rechazado: {
      etiqueta: "Comprobante rechazado",
      clase: "is-error",
      aviso: "No pudimos validar el comprobante que subiste. Revisá el detalle y subí uno nuevo."
    },
    enviado: {
      etiqueta: "En camino",
      clase: "is-ok",
      aviso: "Tu pedido va en camino. Cualquier duda, escribinos por WhatsApp."
    },
    entregado: {
      etiqueta: "Entregado",
      clase: "is-ok",
      aviso: "Este pedido ya fue entregado. ¡Gracias por tu compra!"
    },
    cancelado: {
      etiqueta: "Cancelado",
      clase: "is-error",
      aviso: "Este pedido fue cancelado. Si creés que es un error, escribinos."
    }
  };

  /* Estados en los que todavía se puede (o se debe) subir comprobante. */
  const admiteVoucher = (estado) => estado === "pendiente_pago" || estado === "rechazado";

  const mostrarError = (txt) => {
    const el = document.getElementById("pd-error");
    el.textContent = txt;
    el.classList.toggle("is-visible", !!txt);
  };

  /* ---------- Cuentas bancarias ---------- */
  const pintarCuentas = () => {
    const cont = document.getElementById("pd-cuentas");
    const cuentas = (typeof PAGOS !== "undefined" && PAGOS.cuentas) ? PAGOS.cuentas : [];

    if (!cuentas.length) {
      cont.innerHTML = `<p class="muted">Escribinos por WhatsApp y te pasamos los datos de la cuenta.</p>`;
      return;
    }

    cont.innerHTML = cuentas.map(c => `
      <div class="pd-cuenta">
        <span class="pd-cuenta__banco">${c.banco}</span>
        <div class="pd-cuenta__fila">
          <span class="pd-cuenta__num" data-num>${c.numero}</span>
          <button class="pd-copiar" type="button" data-copiar="${c.numero}">Copiar</button>
        </div>
        <span class="pd-cuenta__meta">${c.tipo} · ${c.titular}</span>
      </div>`).join("");

    // Copiar número de cuenta al portapapeles.
    cont.querySelectorAll("[data-copiar]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copiar);
          const antes = btn.textContent;
          btn.textContent = "¡Copiado!";
          setTimeout(() => (btn.textContent = antes), 1800);
        } catch (e) { /* navegadores viejos: el cliente lo copia a mano */ }
      });
    });
  };

  /* ---------- Render general ---------- */
  const pintar = () => {
    const est = ESTADOS[pedido.estado] || { etiqueta: pedido.estado, clase: "", aviso: "" };

    document.getElementById("pd-numero").textContent = pedido.numero;
    document.getElementById("pd-fecha").textContent =
      new Date(pedido.creado_at).toLocaleDateString("es-HN",
        { day: "numeric", month: "long", year: "numeric" });

    const badge = document.getElementById("pd-badge");
    badge.textContent = est.etiqueta;
    badge.className = `pd-badge ${est.clase}`;

    // Aviso principal. Si fue rechazado y hay motivo, lo mostramos.
    const aviso = document.getElementById("pd-aviso");
    aviso.className = `pd-aviso ${est.clase}`;
    aviso.innerHTML = `<p>${est.aviso}</p>` +
      (pedido.motivo_rechazo
        ? `<p class="pd-aviso__motivo"><strong>Motivo:</strong> ${pedido.motivo_rechazo}</p>`
        : "");

    // Detalle
    document.getElementById("pd-lineas").innerHTML = (pedido.items || []).map(l => `
      <div class="co-linea">
        <div class="co-linea__info">
          <span class="co-linea__nombre">${l.nombre}</span>
          <span class="co-linea__cant">${l.cantidad} × ${fmt(l.precio)}</span>
        </div>
        <span class="co-linea__sub">${fmt(l.subtotal)}</span>
      </div>`).join("");

    document.getElementById("pd-subtotal").textContent = fmt(pedido.subtotal);
    document.getElementById("pd-envio").textContent =
      Number(pedido.envio) === 0 ? "Gratis" : fmt(pedido.envio);
    document.getElementById("pd-total").textContent = fmt(pedido.total);
    document.getElementById("pd-zona").textContent = pedido.zona;

    // Sección de pago: solo si es transferencia y todavía falta validarla.
    const necesitaPagar = pedido.metodo_pago === "transferencia" && admiteVoucher(pedido.estado);
    document.getElementById("pd-pago").hidden = !necesitaPagar;
    if (necesitaPagar) {
      document.getElementById("pd-monto").textContent = fmt(pedido.total);
      pintarCuentas();
    }

    // Botón de WhatsApp con el número de pedido ya escrito.
    document.getElementById("pd-seguimiento").hidden = necesitaPagar;
    const msg = `Hola ${CONFIG.marca}! Consulto por mi pedido #${pedido.numero}.`;
    document.getElementById("pd-wa").href =
      `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  };

  /* ---------- Elegir archivo ---------- */
  const elegirArchivo = (file) => {
    mostrarError("");
    archivo = null;
    document.getElementById("pd-enviar").disabled = true;

    if (!file) return;

    if (file.size > MAX_BYTES) {
      mostrarError("La imagen pesa más de 5 MB. Probá con una foto de menor calidad.");
      return;
    }
    const tiposOk = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!tiposOk.includes(file.type)) {
      mostrarError("El archivo debe ser una imagen (JPG, PNG) o un PDF.");
      return;
    }

    archivo = file;
    document.getElementById("pd-drop-txt").textContent = file.name;
    document.getElementById("pd-enviar").disabled = false;

    // Vista previa solo para imágenes.
    const prev = document.getElementById("pd-preview");
    if (file.type.startsWith("image/")) {
      prev.src = URL.createObjectURL(file);
      prev.hidden = false;
    } else {
      prev.hidden = true;
    }
  };

  /* ---------- Subir el comprobante ---------- */
  const subir = async () => {
    if (!archivo) return;
    mostrarError("");

    const btn = document.getElementById("pd-enviar");
    btn.disabled = true;
    btn.textContent = "Subiendo…";

    // La carpeta DEBE ser el token: así lo exige la política de seguridad
    // del bucket (solo se puede subir a la carpeta de un pedido real).
    const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const ruta = `${token}/voucher-${Date.now()}.${ext}`;

    const { error: errUp } = await sb.storage
      .from("vouchers")
      .upload(ruta, archivo, { cacheControl: "3600", upsert: false });

    if (errUp) {
      btn.disabled = false;
      btn.textContent = "Enviar comprobante";
      mostrarError("No pudimos subir el archivo. Revisá tu conexión e intentá de nuevo.");
      return;
    }

    // Registramos el voucher y pasamos el pedido a "en verificación".
    const { error: errRpc } = await sb.rpc("registrar_voucher", {
      p_token: token,
      p_path:  ruta
    });

    btn.textContent = "Enviar comprobante";

    if (errRpc) {
      btn.disabled = false;
      mostrarError("Subimos el archivo pero no pudimos registrarlo. Escribinos por WhatsApp y lo resolvemos.");
      return;
    }

    await cargar();   // vuelve a leer el pedido: ya estará "en verificación"
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- Cargar el pedido ---------- */
  const cargar = async () => {
    const { data, error } = await sb.rpc("ver_pedido", { p_token: token });

    document.getElementById("pd-cargando").hidden = true;

    if (error || !data) {
      document.getElementById("pd-noencontrado").hidden = false;
      const msg = `Hola ${CONFIG.marca}! Necesito ayuda con un pedido que hice en el sitio.`;
      document.getElementById("pd-wa-ayuda").href =
        `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
      return;
    }

    pedido = data;
    document.getElementById("pd-contenido").hidden = false;
    pintar();
  };

  /* ---------- Arranque ---------- */
  const init = async () => {
    token = new URLSearchParams(location.search).get("t");

    if (!token) {
      document.getElementById("pd-cargando").hidden = true;
      document.getElementById("pd-noencontrado").hidden = false;
      const msg = `Hola ${CONFIG.marca}! Necesito ayuda con un pedido que hice en el sitio.`;
      document.getElementById("pd-wa-ayuda").href =
        `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
      return;
    }

    await cargar();

    // Selector de archivo
    const input = document.getElementById("pd-file");
    document.getElementById("pd-drop").addEventListener("click", (e) => {
      // El <label> ya abre el input; evitamos el doble disparo.
      if (e.target !== input) { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", () => elegirArchivo(input.files[0]));
    document.getElementById("pd-enviar").addEventListener("click", subir);

    // Copiar el enlace del pedido
    document.getElementById("pd-copiar").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(location.href);
        const b = e.currentTarget;
        b.textContent = "¡Copiado!";
        setTimeout(() => (b.textContent = "Copiar enlace"), 1800);
      } catch (err) { /* sin portapapeles: el cliente copia la URL a mano */ }
    });
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", Pedido.init);
