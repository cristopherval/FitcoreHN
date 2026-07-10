/* =========================================================================
   adminpanel.js  —  Panel de administración con Supabase
   -------------------------------------------------------------------------
   · Login real con Supabase Auth (correo + contraseña).
   · Productos guardados en la base de datos → se ven al instante en la tienda.
   · Las fotos se suben a Supabase Storage (bucket "productos").
   · "¿Dónde aparece?": categoría + más vendidos + ofertas de la semana.
   ========================================================================= */

const Admin = (() => {
  const fmt = (n) => (n == null || n === "") ? "—" : `L. ${Number(n).toLocaleString("es-HN")}`;

  let categorias = [];
  let productos = [];

  /* ---------- Avisos ---------- */
  const toast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.add("is-visible");
    setTimeout(() => t.classList.remove("is-visible"), 3000);
  };

  /* ---------- Login ---------- */
  const initLogin = () => {
    const form = document.getElementById("login-form");
    const err = document.getElementById("login-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-pass").value;
      const btn = document.getElementById("btn-login");
      btn.disabled = true; btn.textContent = "Ingresando…";

      const { error } = await sb.auth.signInWithPassword({ email, password });

      btn.disabled = false; btn.textContent = "Ingresar";
      if (error) {
        err.textContent = "Correo o contraseña incorrectos.";
        err.classList.add("is-visible");
        return;
      }
      mostrarPanel();
    });
  };

  const mostrarPanel = async () => {
    document.getElementById("login-view").hidden = true;
    document.getElementById("login-view").style.display = "none";
    document.getElementById("panel-view").hidden = false;
    await cargarDatos();
  };

  const logout = async () => {
    await sb.auth.signOut();
    location.reload();
  };

  /* ---------- Cargar datos desde Supabase ---------- */
  const cargarDatos = async () => {
    const [c, p] = await Promise.all([
      sb.from("categorias").select("*").order("orden", { ascending: true }),
      sb.from("productos").select("*").order("orden", { ascending: true })
    ]);
    if (c.error) { toast("Error cargando categorías: " + c.error.message); return; }
    if (p.error) { toast("Error cargando productos: " + p.error.message); return; }
    categorias = c.data || [];
    productos = p.data || [];
    pintarTabla();
    pintarSelectCategorias();
  };

  const pintarSelectCategorias = () => {
    const sel = document.getElementById("f-cat");
    sel.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
  };

  const nombreCat = (id) => (categorias.find(c => c.id === id) || {}).nombre || "—";

  /* ---------- Tabla ---------- */
  const pintarTabla = () => {
    const body = document.getElementById("tabla-body");
    if (!productos.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No hay productos. Pulsa "+ Agregar producto".</td></tr>`;
      return;
    }
    body.innerHTML = productos.map(p => {
      const secciones = [];
      secciones.push(`<span class="pill">${nombreCat(p.categoria_id)}</span>`);
      if (p.destacado) secciones.push(`<span class="pill pill--ok">Más vendidos</span>`);
      if (p.en_ofertas) secciones.push(`<span class="pill pill--ok">Ofertas</span>`);
      return `
        <tr>
          <td><img class="thumb" src="${p.imagen_url || ""}" alt="${p.nombre}"></td>
          <td>${p.nombre}</td>
          <td>${nombreCat(p.categoria_id)}</td>
          <td>${fmt(p.precio_anterior || p.precio)}</td>
          <td>${p.precio_anterior ? `<span class="promo-tag">${fmt(p.precio)}</span>` : "—"}</td>
          <td class="celda-secciones">${secciones.join(" ")}</td>
          <td class="acciones">
            <button class="btn btn--ghost btn--xs" data-edit="${p.id}">Editar</button>
            <button class="btn btn--danger btn--xs" data-del="${p.id}">Eliminar</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    body.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => eliminar(b.dataset.del)));
  };

  /* ---------- Formulario ---------- */
  const modal = () => document.getElementById("prod-modal");

  const abrirForm = (id) => {
    const p = id ? productos.find(x => String(x.id) === String(id)) : null;
    document.getElementById("prod-modal-title").textContent = p ? "Editar producto" : "Agregar producto";
    document.getElementById("f-id").value = p ? p.id : "";
    document.getElementById("f-nombre").value = p ? p.nombre : "";
    document.getElementById("f-desc").value = p ? (p.descripcion || "") : "";
    // Precio normal = el tachado si hay promo; si no, el precio de venta.
    document.getElementById("f-normal").value = p ? (p.precio_anterior || p.precio) : "";
    document.getElementById("f-promo").value = (p && p.precio_anterior) ? p.precio : "";
    document.getElementById("f-cat").value = p ? p.categoria_id : (categorias[0] && categorias[0].id) || "";
    document.getElementById("f-destacado").checked = p ? !!p.destacado : false;
    document.getElementById("f-ofertas").checked = p ? !!p.en_ofertas : false;
    document.getElementById("f-foto").value = "";

    const prev = document.getElementById("f-preview");
    if (p && p.imagen_url) { prev.src = p.imagen_url; prev.hidden = false; }
    else { prev.hidden = true; prev.removeAttribute("src"); }

    modal().classList.add("is-open");
  };

  const cerrarForm = () => modal().classList.remove("is-open");

  /* Sube la foto al bucket y devuelve su URL pública. */
  const subirFoto = async (file) => {
    const limpio = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const ruta = `${Date.now()}-${limpio}`;
    const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(ruta, file, {
      cacheControl: "3600", upsert: false
    });
    if (error) throw new Error("No se pudo subir la foto: " + error.message);
    return sb.storage.from(SUPABASE_BUCKET).getPublicUrl(ruta).data.publicUrl;
  };

  const initForm = () => {
    document.getElementById("btn-cancel").addEventListener("click", cerrarForm);
    modal().addEventListener("click", (e) => { if (e.target === modal()) cerrarForm(); });

    // Vista previa al elegir foto
    document.getElementById("f-foto").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      const prev = document.getElementById("f-preview");
      if (!f) return;
      prev.src = URL.createObjectURL(f);
      prev.hidden = false;
    });

    document.getElementById("prod-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-save");
      const id = document.getElementById("f-id").value;
      const nombre = document.getElementById("f-nombre").value.trim();
      const descripcion = document.getElementById("f-desc").value.trim();
      const normal = Number(document.getElementById("f-normal").value);
      const promoRaw = document.getElementById("f-promo").value;
      const promo = promoRaw ? Number(promoRaw) : null;
      const categoria_id = document.getElementById("f-cat").value;
      const destacado = document.getElementById("f-destacado").checked;
      const en_ofertas = document.getElementById("f-ofertas").checked;
      const file = document.getElementById("f-foto").files[0];

      if (!nombre || !normal || !categoria_id) { toast("Completa nombre, precio normal y categoría."); return; }
      if (promo && promo >= normal) { toast("El precio promo debe ser MENOR que el normal."); return; }

      // Estructura interna: si hay promo, ese es el precio de venta
      // y el normal queda como precio tachado.
      const precio = promo ? promo : normal;
      const precio_anterior = promo ? normal : null;

      btn.disabled = true; btn.textContent = "Guardando…";
      try {
        let imagen_url;
        if (file) imagen_url = await subirFoto(file);

        if (id) {
          const patch = { nombre, descripcion, precio, precio_anterior, categoria_id, destacado, en_ofertas };
          if (imagen_url) patch.imagen_url = imagen_url;
          const { error } = await sb.from("productos").update(patch).eq("id", id);
          if (error) throw error;
          toast("Producto actualizado.");
        } else {
          const { error } = await sb.from("productos").insert({
            nombre, descripcion, precio, precio_anterior, categoria_id,
            destacado, en_ofertas,
            imagen_url: imagen_url || "assets/atleta-espalda.png",
            orden: productos.length
          });
          if (error) throw error;
          toast("Producto agregado. Ya está en la tienda.");
        }
        cerrarForm();
        await cargarDatos();
      } catch (err) {
        toast("Error: " + (err.message || err));
      } finally {
        btn.disabled = false; btn.textContent = "Guardar producto";
      }
    });
  };

  /* ---------- Eliminar ---------- */
  const eliminar = async (id) => {
    const p = productos.find(x => String(x.id) === String(id));
    const ok = await Confirm.show("Eliminar producto",
      `Esta acción no se puede deshacer. ¿Eliminar "${p ? p.nombre : ""}"?`, "Sí, eliminar");
    if (!ok) return;
    const { error } = await sb.from("productos").delete().eq("id", id);
    if (error) { toast("Error al eliminar: " + error.message); return; }
    toast("Producto eliminado.");
    await cargarDatos();
  };

  /* ---------- Arranque ---------- */
  const init = async () => {
    if (!sb) { alert("No se pudo conectar con Supabase."); return; }
    initLogin();
    initForm();
    document.getElementById("btn-add").addEventListener("click", () => abrirForm(null));
    document.getElementById("btn-logout").addEventListener("click", logout);

    // ¿Ya hay sesión iniciada?
    const { data } = await sb.auth.getSession();
    if (data && data.session) mostrarPanel();
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", Admin.init);
