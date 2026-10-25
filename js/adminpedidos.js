/* =========================================================================
   adminpedidos.js  —  Panel: pedidos, verificación de vouchers y envíos
   -------------------------------------------------------------------------
   Va aparte de adminpanel.js (que maneja el catálogo) porque es otra tarea:
   acá no se edita la tienda, se despachan pedidos.

   Los vouchers viven en un bucket PRIVADO. Para verlos se genera una "URL
   firmada" que expira en una hora: no queda ninguna dirección pública con
   el comprobante bancario de un cliente.
   ========================================================================= */

const AdminPedidos = (() => {
  const fmt = (n) => `L. ${Number(n || 0).toLocaleString("es-HN")}`;

  let pedidos = [];
  let zonas = [];
  let actual = null;          // pedido abierto en el modal
  let filtro = "nueva";

  /* Etiquetas y color de cada estado. */
  const ESTADOS = {
    nueva:     { txt: "Nueva",     clase: "is-verificando" },
    entregada: { txt: "Entregada", clase: "is-ok" },
    cancelada: { txt: "Cancelada", clase: "is-error" }
  };

  const toast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.add("is-visible");
    setTimeout(() => t.classList.remove("is-visible"), 3000);
  };

  const fecha = (iso) => new Date(iso).toLocaleDateString("es-HN",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  /* ---------- Cargar pedidos ---------- */
  const cargar = async () => {
    const { data, error } = await sb
      .from("pedidos").select("*")
      .order("creado_at", { ascending: false })
      .limit(300);

    if (error) {
      document.getElementById("ped-tabla-body").innerHTML =
        `<tr><td colspan="7" class="muted">No se pudieron cargar los pedidos: ${error.message}</td></tr>`;
      return;
    }
    pedidos = data || [];
    pintarTabla();
    pintarContador();
    await cargarZonas();
  };

  /* Insignia con las compras que todavía no despachaste. */
  const pintarContador = () => {
    const n = pedidos.filter(p => p.estado === "nueva").length;
    // El mismo número en la pestaña: así se ve aunque estés en otra sección.
    if (typeof AdminTabs !== "undefined") AdminTabs.setPendientes(n);

    const el = document.getElementById("ped-contador");
    if (!el) return;
    el.hidden = n === 0;
    el.textContent = n === 1 ? "1 sin entregar" : `${n} sin entregar`;
  };

  /* ---------- Tabla de pedidos ---------- */
  const filtrados = () => {
    if (filtro === "") return pedidos;
    // Las que entraron sin comprobante: el cliente no completó el pago.
    if (filtro === "sin_comprobante")
      return pedidos.filter(p => p.estado === "nueva"
        && p.metodo_pago === "transferencia" && !p.voucher_path);
    return pedidos.filter(p => p.estado === filtro);
  };

  const pintarTabla = () => {
    const body = document.getElementById("ped-tabla-body");
    const lista = filtrados();

    if (!lista.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No hay pedidos en este filtro.</td></tr>`;
      return;
    }

    body.innerHTML = lista.map(p => {
      const e = ESTADOS[p.estado] || { txt: p.estado, clase: "" };
      return `
        <tr data-id="${p.id}">
          <td data-label="Pedido"><strong>#${p.numero}</strong></td>
          <td data-label="Fecha" class="muted">${fecha(p.creado_at)}</td>
          <td data-label="Cliente">
            ${escHTML(p.cliente_nombre)}
            <br><small class="muted">${escHTML(p.cliente_telefono)}</small>
          </td>
          <td data-label="Entrega"><small>${escHTML(p.zona_nombre || "—")}</small></td>
          <td data-label="Total"><strong>${fmt(p.total)}</strong></td>
          <td data-label="Estado">
            <span class="pd-badge ${e.clase}">${e.txt}</span>
            ${(p.estado === "nueva" && p.metodo_pago === "transferencia" && !p.voucher_path)
                ? '<br><span class="pd-badge is-error ped-sincomp">Sin comprobante</span>' : ""}
            ${p.metodo_pago === "whatsapp"
                ? '<br><span class="pd-badge ped-sincomp">Por WhatsApp</span>' : ""}
          </td>
          <td data-label="" class="acciones">
            <button class="btn btn--ghost btn--sm" data-ver="${p.id}">Ver</button>
            <button class="btn btn--ghost btn--sm" data-editar-ped="${p.id}">Editar</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-ver]").forEach(b =>
      b.addEventListener("click", () => abrir(b.dataset.ver)));
    // Corregir los datos (cliente, productos, precios…) usa el formulario
    // completo, que vive en adminfinanzas.js.
    body.querySelectorAll("[data-editar-ped]").forEach(b =>
      b.addEventListener("click", () => {
        if (typeof Finanzas !== "undefined") Finanzas.abrir(b.dataset.editarPed);
      }));
  };

  /* ---------- Modal de detalle ---------- */
  const abrir = async (id) => {
    actual = pedidos.find(p => p.id === id);
    if (!actual) return;

    const e = ESTADOS[actual.estado] || { txt: actual.estado, clase: "" };
    document.getElementById("pm-numero").textContent = actual.numero;
    const badge = document.getElementById("pm-badge");
    badge.textContent = e.txt;
    badge.className = `pd-badge ${e.clase}`;

    document.getElementById("pm-nombre").textContent = actual.cliente_nombre;
    document.getElementById("pm-tel").textContent    = actual.cliente_telefono;
    document.getElementById("pm-zona").textContent   = actual.zona_nombre || "—";
    document.getElementById("pm-dir").textContent    = actual.cliente_direccion || "Retiro en punto acordado";
    document.getElementById("pm-notas").textContent  = actual.cliente_notas || "—";
    document.getElementById("pm-metodo").textContent =
      actual.metodo_pago === "whatsapp" ? "Coordinar por WhatsApp (sin comprobante)"
      : actual.metodo_pago === "tarjeta" ? "Tarjeta" : "Transferencia bancaria";

    // La identidad solo se pide en retiros: muéstrala únicamente si está.
    const identRow = document.getElementById("pm-ident-row");
    identRow.hidden = !actual.cliente_identidad;
    if (actual.cliente_identidad)
      document.getElementById("pm-ident").textContent = actual.cliente_identidad;

    // Quién recibe, cuando no es quien compró.
    const destRow = document.getElementById("pm-dest-row");
    destRow.hidden = !actual.envio_a_otro;
    if (actual.envio_a_otro) {
      document.getElementById("pm-dest").textContent =
        `${actual.dest_nombre || "—"} · ${actual.dest_telefono || "—"}`;
    }

    document.getElementById("pm-subtotal").textContent = fmt(actual.subtotal);
    document.getElementById("pm-envio").textContent =
      Number(actual.envio) === 0 ? "Gratis" : fmt(actual.envio);
    document.getElementById("pm-total").textContent = fmt(actual.total);

    document.getElementById("pm-nota").value = actual.nota_admin || "";
    // Reabrir solo tiene sentido en algo ya cerrado.
    document.getElementById("pm-reabrir").hidden = actual.estado === "nueva";
    document.getElementById("pm-entregada").hidden = actual.estado === "entregada";

    const msg = `Hola ${actual.cliente_nombre}! Te escribo de FITCORE HN por tu pedido #${actual.numero}.`;
    const tel = String(actual.cliente_telefono).replace(/\D/g, "");
    // Si el número viene sin código de país, le agregamos el de Honduras.
    const waTel = tel.length === 8 ? `504${tel}` : tel;
    document.getElementById("pm-wa").href =
      `https://wa.me/${waTel}?text=${encodeURIComponent(msg)}`;

    // Líneas del pedido
    const { data: items } = await sb.from("pedido_items")
      .select("*").eq("pedido_id", actual.id);
    document.getElementById("pm-lineas").innerHTML = (items || []).map(i => `
      <div class="co-linea">
        <div class="co-linea__info">
          <span class="co-linea__nombre">${escHTML(i.nombre)}</span>
          <span class="co-linea__cant">${i.cantidad} × ${fmt(i.precio)}</span>
        </div>
        <span class="co-linea__sub">${fmt(i.subtotal)}</span>
      </div>`).join("") || `<p class="muted">Sin productos.</p>`;

    await pintarVoucher();

    document.getElementById("ped-modal").classList.add("is-open");
  };

  /* El voucher se sirve con URL firmada temporal (bucket privado). */
  const pintarVoucher = async () => {
    const wrap = document.getElementById("pm-voucher-wrap");

    if (!actual.voucher_path) {
      wrap.innerHTML = actual.metodo_pago === "whatsapp"
        ? `<p class="muted">Eligió coordinar por WhatsApp: todavía no hay comprobante. Escríbele para arreglar el pago.</p>`
        : `<p class="muted">Todavía no subió comprobante. Puede que no haya completado el pago.</p>`;
      return;
    }

    wrap.innerHTML = `<p class="muted">Cargando comprobante…</p>`;
    const { data, error } = await sb.storage
      .from("vouchers").createSignedUrl(actual.voucher_path, 3600);

    if (error || !data) {
      wrap.innerHTML = `<p class="muted">No se pudo abrir el comprobante.</p>`;
      return;
    }

    const esPdf = actual.voucher_path.toLowerCase().endsWith(".pdf");
    wrap.innerHTML = esPdf
      ? `<a class="btn btn--ghost btn--block btn--sm" href="${data.signedUrl}" target="_blank" rel="noopener">Abrir comprobante (PDF)</a>`
      : `<a href="${data.signedUrl}" target="_blank" rel="noopener" class="pm-voucher-link">
           <img src="${data.signedUrl}" class="pm-voucher" alt="Comprobante de transferencia">
           <small class="muted">Toca la imagen para verla en grande</small>
         </a>`;

    if (actual.voucher_subido_at) {
      wrap.innerHTML += `<p class="muted pm-voucher-fecha">Subido el ${fecha(actual.voucher_subido_at)}</p>`;
    }
  };

  const cerrar = () => {
    document.getElementById("ped-modal").classList.remove("is-open");
    actual = null;
  };

  /* ---------- Cambiar el estado de un pedido ---------- */
  const actualizar = async (campos, mensaje) => {
    if (!actual) return;
    const { error } = await sb.from("pedidos").update(campos).eq("id", actual.id);
    if (error) { toast("Error al guardar: " + error.message); return; }
    toast(mensaje);
    cerrar();
    await cargar();
  };

  const nota = () => document.getElementById("pm-nota").value.trim() || null;

  const marcarEntregada = async () => {
    if (!actual) return;
    const ok = await Confirm.show("Marcar entregada",
      `¿Ya le entregaste el pedido #${actual.numero} a ${actual.cliente_nombre}?`,
      "Sí, entregada");
    if (!ok) return;
    await actualizar({
      estado:       "entregada",
      entregada_at: new Date().toISOString(),
      nota_admin:   nota()
    }, `Pedido #${actual.numero} entregado.`);
  };

  const cancelar = async () => {
    if (!actual) return;
    const ok = await Confirm.show("Cancelar pedido",
      `¿Cancelar el pedido #${actual.numero}? Úsalo cuando no haya pago real detrás, no tengas el producto o no puedas ubicar al cliente. Si ya te pagó, acuérdate de devolverle.`,
      "Sí, cancelar");
    if (!ok) return;
    await actualizar({ estado: "cancelada", nota_admin: nota() },
      `Pedido #${actual.numero} cancelado.`);
  };

  const reabrir = async () => {
    if (!actual) return;
    await actualizar({ estado: "nueva", entregada_at: null, nota_admin: nota() },
      `Pedido #${actual.numero} vuelve a estar abierto.`);
  };

  const guardarNota = async () => {
    if (!actual) return;
    await actualizar({ nota_admin: nota() }, "Nota guardada.");
  };

  /* ---------- Envíos (zonas) ---------- */
  const cargarZonas = async () => {
    const { data, error } = await sb.from("zonas_envio").select("*")
      .order("orden", { ascending: true });
    const body = document.getElementById("zona-tabla-body");
    if (!body) return;

    if (error) {
      body.innerHTML = `<tr><td colspan="4" class="muted">No se pudieron cargar las zonas: ${error.message}</td></tr>`;
      return;
    }
    zonas = data || [];
    const esc = (s) => String(s || "").replace(/"/g, "&quot;");

    body.innerHTML = zonas.map(z => `
      <tr data-zona="${z.id}">
        <td data-label="Zona"><input type="text" class="admin-inline" data-campo="nombre" value="${esc(z.nombre)}"></td>
        <td data-label="Detalle"><input type="text" class="admin-inline" data-campo="descripcion" value="${esc(z.descripcion)}" placeholder="Opcional: condiciones de la entrega"></td>
        <td data-label="Costo (L.)"><input type="number" class="admin-inline admin-inline--num" data-campo="costo" min="0" step="1" value="${Number(z.costo)}"></td>
        <td class="center" data-label="Pide dirección"><input type="checkbox" data-campo="pide_direccion" ${z.pide_direccion ? "checked" : ""}></td>
        <td class="center" data-label="Pide identidad"><input type="checkbox" data-campo="pide_identidad" ${z.pide_identidad ? "checked" : ""}></td>
        <td class="center" data-label="Activa"><input type="checkbox" data-campo="activo" ${z.activo ? "checked" : ""}></td>
        <td data-label="" class="acciones"><button class="btn btn--ghost btn--sm" data-borrar-zona="${z.id}">Borrar</button></td>
      </tr>`).join("");

    body.querySelectorAll("[data-borrar-zona]").forEach(b =>
      b.addEventListener("click", () => borrarZona(b.dataset.borrarZona)));
  };

  /* Agregar una zona nueva (ej. "Envío local San Pedro Sula"). */
  const agregarZona = async () => {
    const nombre = prompt("Nombre de la zona, como la verá el cliente:\nEj. Envío local San Pedro Sula");
    if (!nombre || nombre.trim().length < 3) return;

    const costoTxt = prompt(`Costo de "${nombre.trim()}" en lempiras (0 = gratis):`, "100");
    if (costoTxt === null) return;
    const costo = Number(costoTxt);
    if (!Number.isFinite(costo) || costo < 0) { toast("Costo inválido."); return; }

    // El id es un slug estable: no se muestra, pero es lo que referencian
    // los pedidos ya hechos, así que no debe cambiar nunca.
    const id = nombre.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    if (!id) { toast("No se pudo generar un identificador para esa zona."); return; }

    const orden = zonas.length ? Math.max(...zonas.map(z => z.orden || 0)) + 1 : 1;
    const { error } = await sb.from("zonas_envio").insert({
      id, nombre: nombre.trim(), costo, orden,
      pide_direccion: true, pide_identidad: false, activo: true
    });

    if (error) {
      toast(error.message.includes("duplicate")
        ? "Ya existe una zona con ese nombre."
        : "No se pudo crear la zona: " + error.message);
      return;
    }
    toast("Zona creada.");
    await cargarZonas();
  };

  const borrarZona = async (id) => {
    const z = zonas.find(x => x.id === id);
    const ok = await Confirm.show("Borrar zona de envío",
      `¿Borrar "${z ? z.nombre : id}"? Los pedidos que ya la usaron conservan su costo y su nombre. Si solo quieres dejar de ofrecerla, es mejor desactivarla.`,
      "Sí, borrar");
    if (!ok) return;

    const { error } = await sb.from("zonas_envio").delete().eq("id", id);
    if (error) { toast("No se pudo borrar: " + error.message); return; }
    toast("Zona borrada.");
    await cargarZonas();
  };

  const guardarZonas = async () => {
    const filas = document.querySelectorAll("#zona-tabla-body tr[data-zona]");
    const btn = document.getElementById("btn-guardar-zonas");
    btn.disabled = true; btn.textContent = "Guardando…";

    let fallos = 0;
    for (const fila of filas) {
      const id = fila.dataset.zona;
      const val = (campo) => fila.querySelector(`[data-campo="${campo}"]`);
      const costo = Number(val("costo").value);
      if (!Number.isFinite(costo) || costo < 0) { fallos++; continue; }

      const { error } = await sb.from("zonas_envio").update({
        nombre:         val("nombre").value.trim(),
        descripcion:    val("descripcion").value.trim() || null,
        costo:          costo,
        pide_direccion: val("pide_direccion").checked,
        pide_identidad: val("pide_identidad").checked,
        activo:         val("activo").checked
      }).eq("id", id);
      if (error) fallos++;
    }

    btn.disabled = false; btn.textContent = "Guardar cambios";
    toast(fallos ? `Se guardó con ${fallos} error(es). Revisa los costos.` : "Envíos actualizados.");
    await cargarZonas();
  };

  /* ---------- Arranque ---------- */
  const init = () => {
    if (!sb) return;

    document.getElementById("btn-recargar-ped")?.addEventListener("click", cargar);

    // Cargar un pedido a mano (venta por WhatsApp, apartado, etc.). Usa el
    // mismo formulario que Finanzas, pero el registro nace en "nueva" para
    // que siga el circuito normal de entrega.
    document.getElementById("pm-editar")?.addEventListener("click", () => {
      if (!actual || typeof Finanzas === "undefined") return;
      const id = actual.id;
      cerrar();
      Finanzas.abrir(id);
    });

    document.getElementById("btn-add-pedido")?.addEventListener("click", () => {
      if (typeof Finanzas !== "undefined") Finanzas.abrir(null, "nueva");
    });
    document.getElementById("btn-guardar-zonas")?.addEventListener("click", guardarZonas);
    document.getElementById("btn-add-zona")?.addEventListener("click", agregarZona);

    document.getElementById("pm-entregada")?.addEventListener("click", marcarEntregada);
    document.getElementById("pm-cancelar")?.addEventListener("click", cancelar);
    document.getElementById("pm-reabrir")?.addEventListener("click", reabrir);
    document.getElementById("pm-guardar-nota")?.addEventListener("click", guardarNota);
    document.getElementById("pm-cerrar")?.addEventListener("click", cerrar);

    // Clic fuera del cuadro cierra el modal.
    document.getElementById("ped-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "ped-modal") cerrar();
    });

    // Filtros
    document.getElementById("ped-filtros")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".admin-chip");
      if (!chip) return;
      document.querySelectorAll("#ped-filtros .admin-chip")
        .forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      filtro = chip.dataset.estado;
      pintarTabla();
    });
  };

  return { init, cargar };
})();

document.addEventListener("DOMContentLoaded", AdminPedidos.init);
