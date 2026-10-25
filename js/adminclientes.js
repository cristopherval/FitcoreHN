/* =========================================================================
   adminclientes.js  —  Fichas de clientes
   -------------------------------------------------------------------------
   El nombre y el teléfono ya vivían dentro de cada pedido, pero ahí no
   sirven para nada más que para ese pedido: no se sabe quién repite ni se
   puede corregir un nombre mal escrito sin tocar el histórico.

   Ahora cada pedido apunta a una ficha (ver clientes.sql). La ficha se crea
   sola cuando entra una compra, y aquí se consulta, se corrige y se le
   agregan notas.

   Lo que gastó cada uno NO se guarda: se suma de sus pedidos entregados
   cada vez. Un total guardado se desincroniza en cuanto corriges una venta.
   ========================================================================= */

const Clientes = (() => {
  const fmt = (n) => `L. ${Number(n || 0).toLocaleString("es-HN")}`;

  let clientes = [];
  let resumen = {};              // cliente_id -> { compras, gastado, ultima }
  const vista = { buscar: "", orden: "gastado" };

  const toast = (m) => (typeof Admin !== "undefined" && Admin.toast)
    ? Admin.toast(m) : alert(m);

  const fechaCorta = (iso) => iso
    ? new Date(iso).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  /* ---------- Carga ---------- */
  const cargar = async () => {
    const [cli, ped] = await Promise.all([
      sb.from("clientes").select("*").order("nombre", { ascending: true }),
      // Solo las entregadas cuentan como "lo que te ha comprado".
      sb.from("pedidos").select("cliente_id,total,creado_at,estado").eq("estado", "entregada")
    ]);

    const body = document.getElementById("cli-tabla-body");
    if (cli.error) {
      if (body) body.innerHTML = `<tr><td colspan="6" class="muted">${
        /clientes/i.test(cli.error.message)
          ? "Falta correr el SQL de clientes en Supabase (clientes.sql)."
          : "No se pudieron cargar: " + cli.error.message}</td></tr>`;
      return;
    }

    clientes = cli.data || [];
    resumen = {};
    (ped.data || []).forEach(p => {
      if (!p.cliente_id) return;
      const r = resumen[p.cliente_id] || (resumen[p.cliente_id] = { compras: 0, gastado: 0, ultima: null });
      r.compras++;
      r.gastado += Number(p.total || 0);
      if (!r.ultima || p.creado_at > r.ultima) r.ultima = p.creado_at;
    });
    pintar();
  };

  /* ---------- Lista ---------- */
  const datos = (c) => resumen[c.id] || { compras: 0, gastado: 0, ultima: null };

  const filtrados = () => {
    const q = vista.buscar.trim().toLowerCase();
    let l = clientes.filter(c =>
      !q || c.nombre.toLowerCase().includes(q) || (c.telefono || "").includes(q));

    switch (vista.orden) {
      case "nombre":   l.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })); break;
      // Sin compras no hay fecha: esos van al final.
      case "reciente": l.sort((a, b) => (datos(b).ultima || "").localeCompare(datos(a).ultima || "")); break;
      default:         l.sort((a, b) => datos(b).gastado - datos(a).gastado); break;
    }
    return l;
  };

  const pintar = () => {
    const body = document.getElementById("cli-tabla-body");
    if (!body) return;
    const lista = filtrados();

    const conteo = document.getElementById("cli-conteo");
    if (conteo) {
      conteo.textContent = lista.length === clientes.length
        ? `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""}`
        : `${lista.length} de ${clientes.length}`;
    }

    if (!clientes.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">Todavía no hay clientes. Se registran solos con cada compra.</td></tr>`;
      return;
    }
    if (!lista.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">Ninguno coincide con la búsqueda.</td></tr>`;
      return;
    }

    body.innerHTML = lista.map(c => {
      const d = datos(c);
      return `
        <tr data-id="${c.id}">
          <td data-label="Cliente"><strong>${escHTML(c.nombre)}</strong></td>
          <td data-label="Teléfono"><small class="muted">${escHTML(c.telefono || "—")}</small></td>
          <td data-label="Compras">${d.compras}</td>
          <td data-label="Total"><strong>${fmt(d.gastado)}</strong></td>
          <td data-label="Última" class="muted"><small>${fechaCorta(d.ultima)}</small></td>
          <td data-label="" class="acciones">
            <button class="btn btn--ghost btn--sm" data-edit-cli="${c.id}">Ver ficha</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-edit-cli]").forEach(b =>
      b.addEventListener("click", () => abrir(b.dataset.editCli)));
  };

  /* ---------- Ficha ---------- */
  const modal = () => document.getElementById("cliente-modal");
  const cerrar = () => modal().classList.remove("is-open");

  const abrir = async (id) => {
    const c = id ? clientes.find(x => x.id === id) : null;
    document.getElementById("cli-modal-title").textContent = c ? c.nombre : "Agregar cliente";
    document.getElementById("c-id").value = c ? c.id : "";
    document.getElementById("c-nombre").value = c ? c.nombre : "";
    document.getElementById("c-tel").value = c ? (c.telefono || "") : "";
    document.getElementById("c-ident").value = c ? (c.identidad || "") : "";
    document.getElementById("c-dir").value = c ? (c.direccion || "") : "";
    document.getElementById("c-notas").value = c ? (c.notas || "") : "";

    const del = document.getElementById("btn-del-cliente");
    del.hidden = !c;
    del.onclick = c ? () => eliminar(c.id, c.nombre) : null;

    const wrap = document.getElementById("c-historial-wrap");
    wrap.hidden = !c;
    if (c) pintarHistorial(c.id);

    modal().classList.add("is-open");
  };

  /* Sus compras, de la más reciente a la más vieja. Se piden al abrir la
     ficha y no antes: son datos que solo se miran de a uno. */
  const pintarHistorial = async (clienteId) => {
    const cont = document.getElementById("c-historial");
    cont.innerHTML = `<p class="muted">Cargando…</p>`;

    const { data, error } = await sb.from("pedidos")
      .select("numero,creado_at,total,estado")
      .eq("cliente_id", clienteId)
      .order("creado_at", { ascending: false });

    if (error || !data || !data.length) {
      cont.innerHTML = `<p class="muted">Todavía no tiene compras registradas.</p>`;
      return;
    }

    const ESTADOS = { nueva: "Pendiente", entregada: "Entregada", cancelada: "Cancelada" };
    cont.innerHTML = data.map(p => `
      <div class="cli-compra">
        <span class="cli-compra__num">#${p.numero}</span>
        <span class="cli-compra__fecha muted">${fechaCorta(p.creado_at)}</span>
        <span class="pd-badge ${p.estado === "entregada" ? "is-ok" : ""}">${ESTADOS[p.estado] || p.estado}</span>
        <span class="cli-compra__total">${fmt(p.total)}</span>
      </div>`).join("");
  };

  /* ---------- Guardar ---------- */
  const guardar = async (e) => {
    e.preventDefault();
    const id = document.getElementById("c-id").value;
    const datosCli = {
      nombre: document.getElementById("c-nombre").value.trim(),
      telefono: document.getElementById("c-tel").value.trim() || null,
      identidad: document.getElementById("c-ident").value.trim() || null,
      direccion: document.getElementById("c-dir").value.trim() || null,
      notas: document.getElementById("c-notas").value.trim() || null,
      actualizado_at: new Date().toISOString()
    };
    if (!datosCli.nombre) { toast("El nombre es obligatorio."); return; }

    const btn = document.getElementById("btn-save-cliente");
    btn.disabled = true;

    const { error } = id
      ? await sb.from("clientes").update(datosCli).eq("id", id)
      : await sb.from("clientes").insert(datosCli);

    btn.disabled = false;
    if (error) {
      // El teléfono es único: dos fichas con el mismo número serían la misma persona.
      toast(/duplicate|unique/i.test(error.message)
        ? "Ya hay un cliente con ese teléfono."
        : "No se pudo guardar: " + error.message);
      return;
    }

    toast(id ? "Cliente actualizado." : "Cliente agregado.");
    cerrar();
    await cargar();
  };

  const eliminar = async (id, nombre) => {
    const ok = await Confirm.show("Eliminar cliente",
      `Se borra la ficha de "${nombre}". Sus pedidos NO se borran: conservan su nombre y teléfono.`,
      "Sí, eliminar");
    if (!ok) return;
    const { error } = await sb.from("clientes").delete().eq("id", id);
    if (error) { toast("No se pudo eliminar: " + error.message); return; }
    toast("Ficha eliminada.");
    cerrar();
    await cargar();
  };

  /* Los que ya están registrados, para sugerirlos al armar una venta. */
  const lista = () => clientes;

  /* ---------- Arranque ---------- */
  const init = () => {
    const form = document.getElementById("cliente-form");
    if (!form) return;

    form.addEventListener("submit", guardar);
    document.getElementById("btn-add-cliente").addEventListener("click", () => abrir(null));
    document.getElementById("cli-close").addEventListener("click", cerrar);
    document.getElementById("btn-cancel-cliente").addEventListener("click", cerrar);

    const enlazar = (id, evento, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evento, () => { fn(el.value); pintar(); });
    };
    enlazar("cli-buscar", "input", v => vista.buscar = v);
    enlazar("cli-orden", "change", v => vista.orden = v);

    document.addEventListener("admin:tab", (e) => {
      if (e.detail.tab === "clientes") cargar();
    });
  };

  return { init, cargar, lista, abrir };
})();

document.addEventListener("DOMContentLoaded", Clientes.init);
