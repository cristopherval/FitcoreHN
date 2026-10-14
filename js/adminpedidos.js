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
  let filtro = "por_revisar";

  /* Etiquetas y color de cada estado. */
  const ESTADOS = {
    pendiente_pago:  { txt: "Esperando pago",  clase: "is-pendiente" },
    en_verificacion: { txt: "En verificación", clase: "is-verificando" },
    verificado:      { txt: "Pago confirmado", clase: "is-ok" },
    rechazado:       { txt: "Rechazado",       clase: "is-error" },
    enviado:         { txt: "Enviado",         clase: "is-ok" },
    entregado:       { txt: "Entregado",       clase: "is-ok" },
    cancelado:       { txt: "Cancelado",       clase: "is-error" }
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

  /* Insignia con los que esperan revisión. */
  const pintarContador = () => {
    const n = pedidos.filter(p => p.estado === "en_verificacion").length;
    const el = document.getElementById("ped-contador");
    if (!el) return;
    el.hidden = n === 0;
    el.textContent = n === 1 ? "1 por revisar" : `${n} por revisar`;
  };

  /* ---------- Tabla de pedidos ---------- */
  const filtrados = () => {
    if (filtro === "") return pedidos;
    if (filtro === "por_revisar") return pedidos.filter(p => p.estado === "en_verificacion");
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
          <td><strong>#${p.numero}</strong></td>
          <td class="muted">${fecha(p.creado_at)}</td>
          <td>
            ${p.cliente_nombre}
            <br><small class="muted">${p.cliente_telefono}</small>
          </td>
          <td><small>${p.zona_nombre || "—"}</small></td>
          <td><strong>${fmt(p.total)}</strong></td>
          <td><span class="pd-badge ${e.clase}">${e.txt}</span></td>
          <td>
            <button class="btn btn--ghost btn--sm" data-ver="${p.id}">
              ${p.estado === "en_verificacion" ? "Revisar" : "Ver"}
            </button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-ver]").forEach(b =>
      b.addEventListener("click", () => abrir(b.dataset.ver)));
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

    document.getElementById("pm-subtotal").textContent = fmt(actual.subtotal);
    document.getElementById("pm-envio").textContent =
      Number(actual.envio) === 0 ? "Gratis" : fmt(actual.envio);
    document.getElementById("pm-total").textContent = fmt(actual.total);

    document.getElementById("pm-nota").value   = actual.nota_admin || "";
    document.getElementById("pm-motivo").value = actual.motivo_rechazo || "";
    document.getElementById("pm-estado").value = actual.estado;

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
          <span class="co-linea__nombre">${i.nombre}</span>
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
      wrap.innerHTML = `<p class="muted">Todavía no subió comprobante.</p>`;
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
           <small class="muted">Tocá la imagen para verla en grande</small>
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

  const aprobar = async () => {
    if (!actual) return;
    const ok = await Confirm.show("Confirmar pago",
      `¿Confirmás que recibiste ${fmt(actual.total)} del pedido #${actual.numero}? El cliente verá su pago como aprobado.`,
      "Sí, confirmar");
    if (!ok) return;

    const { data: sesion } = await sb.auth.getUser();
    await actualizar({
      estado:         "verificado",
      verificado_at:  new Date().toISOString(),
      verificado_por: sesion?.user?.id || null,
      nota_admin:     document.getElementById("pm-nota").value.trim() || null,
      motivo_rechazo: null
    }, `Pedido #${actual.numero} confirmado.`);
  };

  const rechazar = async () => {
    if (!actual) return;
    const motivo = document.getElementById("pm-motivo").value.trim();
    if (!motivo) {
      toast("Escribí el motivo: el cliente lo necesita para corregir.");
      document.getElementById("pm-motivo").focus();
      return;
    }
    const ok = await Confirm.show("Rechazar comprobante",
      `El cliente verá: "${motivo}" y podrá subir otro comprobante. ¿Continuar?`,
      "Sí, rechazar");
    if (!ok) return;

    await actualizar({
      estado:         "rechazado",
      motivo_rechazo: motivo,
      nota_admin:     document.getElementById("pm-nota").value.trim() || null
    }, `Pedido #${actual.numero} rechazado.`);
  };

  const guardarEstado = async () => {
    if (!actual) return;
    const nuevo = document.getElementById("pm-estado").value;
    await actualizar({
      estado:         nuevo,
      nota_admin:     document.getElementById("pm-nota").value.trim() || null,
      motivo_rechazo: nuevo === "rechazado"
        ? (document.getElementById("pm-motivo").value.trim() || null)
        : null
    }, `Pedido #${actual.numero}: ${(ESTADOS[nuevo] || {}).txt || nuevo}.`);
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
    body.innerHTML = zonas.map(z => `
      <tr data-zona="${z.id}">
        <td><input type="text" class="admin-inline" data-campo="nombre" value="${z.nombre}"></td>
        <td><input type="number" class="admin-inline admin-inline--num" data-campo="costo" min="0" step="1" value="${Number(z.costo)}"></td>
        <td class="center"><input type="checkbox" data-campo="pide_direccion" ${z.pide_direccion ? "checked" : ""}></td>
        <td class="center"><input type="checkbox" data-campo="activo" ${z.activo ? "checked" : ""}></td>
      </tr>`).join("");
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
        costo:          costo,
        pide_direccion: val("pide_direccion").checked,
        activo:         val("activo").checked
      }).eq("id", id);
      if (error) fallos++;
    }

    btn.disabled = false; btn.textContent = "Guardar cambios";
    toast(fallos ? `Se guardó con ${fallos} error(es). Revisá los costos.` : "Envíos actualizados.");
    await cargarZonas();
  };

  /* ---------- Arranque ---------- */
  const init = () => {
    if (!sb) return;

    document.getElementById("btn-recargar-ped")?.addEventListener("click", cargar);
    document.getElementById("btn-guardar-zonas")?.addEventListener("click", guardarZonas);

    document.getElementById("pm-aprobar")?.addEventListener("click", aprobar);
    document.getElementById("pm-rechazar")?.addEventListener("click", rechazar);
    document.getElementById("pm-guardar-estado")?.addEventListener("click", guardarEstado);
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
