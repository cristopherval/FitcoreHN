/* =========================================================================
   adminfinanzas.js  —  Ventas concretadas
   -------------------------------------------------------------------------
   La sección de Pedidos sirve para despachar: lo que entró hoy y hay que
   entregar. Finanzas mira lo contrario, lo que ya se cobró, y suma.

   Una venta aquí es un pedido en estado "entregada", venga de donde venga:
   de la tienda (el cliente compró y después la marcaste entregada) o de
   mostrador (se la vendiste en persona y la cargas a mano). Las dos cuentan
   igual para el total del mes, y por eso se guardan en la misma tabla.

   Se puede corregir cualquier dato y se puede borrar: las líneas del pedido
   caen solas con él (on delete cascade).
   ========================================================================= */

const Finanzas = (() => {
  const fmt = (n) => `L. ${Number(n || 0).toLocaleString("es-HN")}`;

  let ventas = [];        // pedidos entregados
  let lineas = [];        // líneas de la venta que se está editando
  let catalogo = [];      // productos, para los selectores
  let zonas = [];
  let editando = null;    // el pedido abierto, o null si es nueva
  const vista = { periodo: "mes", origen: "", buscar: "" };

  const toast = (m) => (typeof Admin !== "undefined" && Admin.toast)
    ? Admin.toast(m) : alert(m);

  /* ---------- Fechas ---------- */

  /* Rango del periodo elegido, en hora local. `desde` incluido, `hasta`
     excluido, para no perder ni duplicar la venta del último día. */
  const rango = () => {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    switch (vista.periodo) {
      case "mes":        return [new Date(y, m, 1), new Date(y, m + 1, 1)];
      case "mes-pasado": return [new Date(y, m - 1, 1), new Date(y, m, 1)];
      case "anio":       return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
      default:           return [null, null];
    }
  };

  const fechaCorta = (iso) => new Date(iso).toLocaleDateString("es-HN",
    { day: "2-digit", month: "short", year: "numeric" });

  /* El <input type="datetime-local"> no entiende zonas horarias: hay que
     darle la hora local ya formateada, no el ISO en UTC. */
  const paraInput = (iso) => {
    const d = iso ? new Date(iso) : new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  /* ---------- Carga ---------- */
  const cargar = async () => {
    const [ped, prod, zon] = await Promise.all([
      sb.from("pedidos").select("*").eq("estado", "entregada").order("creado_at", { ascending: false }),
      sb.from("productos").select("id,nombre,precio").order("nombre", { ascending: true }),
      sb.from("zonas_envio").select("*").order("orden", { ascending: true })
    ]);

    if (ped.error) {
      document.getElementById("fin-tabla-body").innerHTML =
        `<tr><td colspan="7" class="muted">No se pudieron cargar las ventas: ${ped.error.message}</td></tr>`;
      return;
    }
    ventas = ped.data || [];
    catalogo = prod.data || [];
    zonas = zon.data || [];
    pintar();
  };

  /* ---------- Lista y resumen ---------- */
  const filtradas = () => {
    const [desde, hasta] = rango();
    const q = vista.buscar.trim().toLowerCase();
    return ventas.filter(v => {
      const f = new Date(v.creado_at);
      if (desde && (f < desde || f >= hasta)) return false;
      if (vista.origen && (v.origen || "tienda") !== vista.origen) return false;
      if (!q) return true;
      return (v.cliente_nombre || "").toLowerCase().includes(q) ||
             String(v.numero).includes(q);
    });
  };

  const pintarResumen = (lista) => {
    const cont = document.getElementById("fin-resumen");
    if (!cont) return;
    const total = lista.reduce((a, v) => a + Number(v.total || 0), 0);
    const envios = lista.reduce((a, v) => a + Number(v.envio || 0), 0);
    const n = lista.length;
    // El promedio sin ventas es 0, no "NaN".
    const promedio = n ? Math.round(total / n) : 0;

    cont.innerHTML = `
      <div class="fin-card fin-card--fuerte">
        <span class="fin-card__label">Vendido</span>
        <strong class="fin-card__valor">${fmt(total)}</strong>
      </div>
      <div class="fin-card">
        <span class="fin-card__label">Ventas</span>
        <strong class="fin-card__valor">${n}</strong>
      </div>
      <div class="fin-card">
        <span class="fin-card__label">Promedio</span>
        <strong class="fin-card__valor">${fmt(promedio)}</strong>
      </div>
      <div class="fin-card">
        <span class="fin-card__label">Cobrado en envíos</span>
        <strong class="fin-card__valor">${fmt(envios)}</strong>
      </div>`;
  };

  const PAGOS = {
    efectivo: "Efectivo", transferencia: "Transferencia",
    tarjeta: "Tarjeta", whatsapp: "WhatsApp"
  };

  const pintar = () => {
    const lista = filtradas();
    pintarResumen(lista);

    const body = document.getElementById("fin-tabla-body");
    if (!body) return;

    if (!lista.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No hay ventas en este periodo.</td></tr>`;
      return;
    }

    body.innerHTML = lista.map(v => {
      const mostrador = (v.origen || "tienda") === "mostrador";
      return `
        <tr data-id="${v.id}">
          <td data-label="Venta"><strong>#${v.numero}</strong></td>
          <td data-label="Fecha" class="muted">${fechaCorta(v.creado_at)}</td>
          <td data-label="Cliente">
            ${v.cliente_nombre}
            <br><small class="muted">${v.cliente_telefono || ""}</small>
          </td>
          <td data-label="Origen">
            <span class="pd-badge ${mostrador ? "" : "is-ok"}">${mostrador ? "Mostrador" : "Tienda"}</span>
          </td>
          <td data-label="Total"><strong>${fmt(v.total)}</strong></td>
          <td data-label="Pago"><small>${PAGOS[v.metodo_pago] || v.metodo_pago}</small></td>
          <td data-label="" class="acciones">
            <button class="btn btn--ghost btn--sm" data-editar-venta="${v.id}">Editar</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-editar-venta]").forEach(b =>
      b.addEventListener("click", () => abrir(b.dataset.editarVenta)));
  };

  /* ---------- Líneas de producto del formulario ---------- */
  const pintarLineas = () => {
    const cont = document.getElementById("v-lineas");
    if (!cont) return;

    if (!lineas.length) {
      cont.innerHTML = `<p class="muted">Sin productos. Agrega al menos uno.</p>`;
      recalcular();
      return;
    }

    cont.innerHTML = lineas.map((l, i) => `
      <div class="venta-linea" data-i="${i}">
        <select data-campo="producto" aria-label="Producto">
          <option value="">— Elegir producto —</option>
          ${catalogo.map(p => `<option value="${p.id}" ${p.id === l.producto_id ? "selected" : ""}>${p.nombre}</option>`).join("")}
        </select>
        <input type="number" data-campo="cantidad" min="1" step="1" value="${l.cantidad}" aria-label="Cantidad">
        <input type="number" data-campo="precio" min="0" step="1" value="${l.precio}" aria-label="Precio unitario">
        <span class="venta-linea__sub">${fmt(l.precio * l.cantidad)}</span>
        <button type="button" class="btn-ojo" data-quitar="${i}" title="Quitar" aria-label="Quitar producto">✕</button>
      </div>`).join("");

    cont.querySelectorAll("[data-campo]").forEach(el => {
      el.addEventListener("change", () => {
        const i = Number(el.closest(".venta-linea").dataset.i);
        const campo = el.dataset.campo;
        if (campo === "producto") {
          const p = catalogo.find(x => x.id === el.value);
          lineas[i].producto_id = el.value || null;
          lineas[i].nombre = p ? p.nombre : "";
          // Al elegir producto se trae su precio actual, pero queda editable.
          if (p) lineas[i].precio = Number(p.precio);
        } else if (campo === "cantidad") {
          lineas[i].cantidad = Math.max(1, Number(el.value) || 1);
        } else {
          lineas[i].precio = Math.max(0, Number(el.value) || 0);
        }
        pintarLineas();
      });
    });

    cont.querySelectorAll("[data-quitar]").forEach(b =>
      b.addEventListener("click", () => {
        lineas.splice(Number(b.dataset.quitar), 1);
        pintarLineas();
      }));

    recalcular();
  };

  const completas = () => lineas.filter(l => l.producto_id && l.cantidad > 0);

  const recalcular = () => {
    const sub = completas().reduce((a, l) => a + l.precio * l.cantidad, 0);
    const envio = Number(document.getElementById("v-envio").value) || 0;
    document.getElementById("v-subtotal").textContent = fmt(sub);
    document.getElementById("v-envio-txt").textContent = fmt(envio);
    document.getElementById("v-total").textContent = fmt(sub + envio);
    return { sub, envio, total: sub + envio };
  };

  /* ---------- Abrir / cerrar el formulario ---------- */
  const modal = () => document.getElementById("venta-modal");
  const cerrar = () => modal().classList.remove("is-open");

  const pintarZonas = (elegida) => {
    const sel = document.getElementById("v-zona");
    sel.innerHTML = `<option value="">Entrega en persona</option>` +
      zonas.map(z => `<option value="${z.id}">${z.nombre}</option>`).join("");
    if (elegida) sel.value = elegida;
  };

  const abrir = async (id) => {
    const v = id ? ventas.find(x => x.id === id) : null;
    editando = v;

    document.getElementById("venta-modal-title").textContent = v ? `Venta #${v.numero}` : "Registrar venta";
    document.getElementById("v-id").value = v ? v.id : "";
    document.getElementById("v-nombre").value = v ? (v.cliente_nombre || "") : "";
    document.getElementById("v-tel").value = v ? (v.cliente_telefono || "") : "";
    document.getElementById("v-fecha").value = paraInput(v ? v.creado_at : null);
    document.getElementById("v-pago").value = v ? v.metodo_pago : "efectivo";
    document.getElementById("v-envio").value = v ? Number(v.envio || 0) : 0;
    document.getElementById("v-dir").value = v ? (v.cliente_direccion || "") : "";
    document.getElementById("v-nota").value = v ? (v.nota_admin || "") : "";
    pintarZonas(v ? v.zona_id : "");

    // Las líneas de una venta ya existente se traen de la base; una nueva
    // empieza con un renglón vacío listo para elegir.
    if (v) {
      const { data } = await sb.from("pedido_items").select("*").eq("pedido_id", v.id);
      lineas = (data || []).map(i => ({
        producto_id: i.producto_id, nombre: i.nombre,
        precio: Number(i.precio), cantidad: Number(i.cantidad)
      }));
    } else {
      lineas = [{ producto_id: null, nombre: "", precio: 0, cantidad: 1 }];
    }
    pintarLineas();

    const del = document.getElementById("btn-del-venta");
    del.hidden = !v;
    del.onclick = v ? () => eliminar(v.id, v.numero) : null;

    modal().classList.add("is-open");
  };

  /* ---------- Guardar ---------- */
  const guardar = async (e) => {
    e.preventDefault();

    const validas = completas();
    if (!validas.length) { toast("Agrega al menos un producto a la venta."); return; }

    const { sub, envio, total } = recalcular();
    const zonaSel = document.getElementById("v-zona");
    const zonaId = zonaSel.value || null;
    const zonaNombre = zonaId
      ? (zonas.find(z => z.id === zonaId) || {}).nombre
      : "Entrega en persona";

    const fecha = new Date(document.getElementById("v-fecha").value);
    const datos = {
      cliente_nombre: document.getElementById("v-nombre").value.trim(),
      cliente_telefono: document.getElementById("v-tel").value.trim(),
      cliente_direccion: document.getElementById("v-dir").value.trim() || null,
      metodo_pago: document.getElementById("v-pago").value,
      zona_id: zonaId,
      zona_nombre: zonaNombre,
      subtotal: sub, envio, total,
      estado: "entregada",
      nota_admin: document.getElementById("v-nota").value.trim() || null,
      creado_at: fecha.toISOString(),
      entregada_at: fecha.toISOString()
    };

    const btn = document.getElementById("btn-save-venta");
    btn.disabled = true;

    let pedidoId = editando ? editando.id : null;

    if (editando) {
      const { error } = await sb.from("pedidos").update(datos).eq("id", editando.id);
      if (error) { btn.disabled = false; toast(aviso(error)); return; }
    } else {
      // Una venta cargada a mano nace ya entregada y marcada como mostrador.
      const { data, error } = await sb.from("pedidos")
        .insert({ ...datos, origen: "mostrador" }).select("id").single();
      if (error) { btn.disabled = false; toast(aviso(error)); return; }
      pedidoId = data.id;
    }

    // Las líneas se reemplazan enteras: es más simple y más fiable que
    // averiguar cuál cambió, y son pocas.
    await sb.from("pedido_items").delete().eq("pedido_id", pedidoId);
    const { error: errItems } = await sb.from("pedido_items").insert(
      validas.map(l => ({
        pedido_id: pedidoId, producto_id: l.producto_id, nombre: l.nombre,
        precio: l.precio, cantidad: l.cantidad, subtotal: l.precio * l.cantidad
      })));

    btn.disabled = false;
    if (errItems) { toast("La venta se guardó, pero sus productos no: " + errItems.message); return; }

    toast(editando ? "Venta actualizada." : "Venta registrada.");
    cerrar();
    await cargar();
  };

  /* Mensaje claro cuando falta correr el SQL de esta sección. */
  const aviso = (error) => {
    const m = error.message || "";
    if (/origen/i.test(m) || /metodo_pago/i.test(m))
      return "Falta correr el SQL de Finanzas en Supabase (finanzas.sql).";
    return "No se pudo guardar: " + m;
  };

  const eliminar = async (id, numero) => {
    const ok = await Confirm.show("Eliminar venta",
      `Se borra la venta #${numero} y sus productos. Esto no se puede deshacer.`,
      "Sí, eliminar");
    if (!ok) return;
    const { error } = await sb.from("pedidos").delete().eq("id", id);
    if (error) { toast("No se pudo eliminar: " + error.message); return; }
    toast("Venta eliminada.");
    cerrar();
    await cargar();
  };

  /* ---------- Arranque ---------- */
  const init = () => {
    const form = document.getElementById("venta-form");
    if (!form) return;

    form.addEventListener("submit", guardar);
    document.getElementById("btn-add-venta").addEventListener("click", () => abrir(null));
    document.getElementById("venta-close").addEventListener("click", cerrar);
    document.getElementById("btn-cancel-venta").addEventListener("click", cerrar);
    document.getElementById("v-envio").addEventListener("input", recalcular);
    document.getElementById("v-add-linea").addEventListener("click", () => {
      lineas.push({ producto_id: null, nombre: "", precio: 0, cantidad: 1 });
      pintarLineas();
    });

    const enlazar = (id, evento, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evento, () => { fn(el.value); pintar(); });
    };
    enlazar("fin-periodo", "change", v => vista.periodo = v);
    enlazar("fin-origen", "change", v => vista.origen = v);
    enlazar("fin-buscar", "input", v => vista.buscar = v);

    // Igual que en Productos: abiertos en escritorio, plegados en celular.
    const filtrador = document.getElementById("fin-filtrador");
    if (filtrador && window.innerWidth > 900) filtrador.open = true;

    // Se carga al entrar a la pestaña, no al abrir el panel: así no se piden
    // estas consultas si nunca miras Finanzas. Y se recarga cada vez que
    // entras, para que lo que acabas de marcar entregado ya aparezca.
    document.addEventListener("admin:tab", (e) => {
      if (e.detail.tab === "finanzas") cargar();
    });
  };

  return { init, cargar };
})();

document.addEventListener("DOMContentLoaded", Finanzas.init);
