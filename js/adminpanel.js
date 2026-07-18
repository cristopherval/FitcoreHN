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
  let marcas = [];

  /* IDs de las categorías principales (fijas): no se pueden borrar. */
  const PRINCIPALES = (typeof CATEGORIAS_PRINCIPALES !== "undefined") ? CATEGORIAS_PRINCIPALES : [];
  const esPrincipal = (id) => PRINCIPALES.includes(id);

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
    const [c, p, m] = await Promise.all([
      sb.from("categorias").select("*").order("orden", { ascending: true }),
      sb.from("productos").select("*").order("orden", { ascending: true }),
      sb.from("marcas").select("*").order("orden", { ascending: true })
    ]);
    if (c.error) { toast("Error cargando categorías: " + c.error.message); return; }
    if (p.error) { toast("Error cargando productos: " + p.error.message); return; }
    categorias = c.data || [];
    productos = p.data || [];
    // "marcas" es opcional: si aún no creaste la tabla, el panel sigue funcionando.
    marcas = (m.error) ? [] : (m.data || []);
    if (m.error) toast("Marcas no disponibles: crea la tabla en Supabase (revisa las instrucciones).");
    pintarTabla();
    pintarTablaCategorias();
    pintarTablaMarcas();
    pintarSelectCategorias();
    pintarSelectMarcas();
  };

  const pintarSelectCategorias = () => {
    const sel = document.getElementById("f-cat");
    sel.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
  };

  const pintarSelectMarcas = () => {
    const sel = document.getElementById("f-marca");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Sin marca —</option>` +
      marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join("");
  };

  const nombreCat = (id) => (categorias.find(c => c.id === id) || {}).nombre || "—";
  const nombreMarca = (id) => (marcas.find(m => m.id === id) || {}).nombre || "—";

  /* ---------- Categorías: tabla ---------- */
  const pintarTablaCategorias = () => {
    const body = document.getElementById("cat-tabla-body");
    if (!body) return;
    if (!categorias.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">No hay categorías. Pulsa "+ Agregar categoría".</td></tr>`;
      return;
    }
    body.innerHTML = categorias.map(c => {
      const prodsCat = productos.filter(p => p.categoria_id === c.id);
      const nProd = prodsCat.length;
      // Muestra la imagen propia; si no tiene, la del primer producto (lo mismo que verá la tienda).
      const img = c.imagen_url || (prodsCat[0] && prodsCat[0].imagen_url) || "";
      const fija = esPrincipal(c.id);
      const tipo = fija
        ? `<span class="pill pill--ok">Principal</span>`
        : `<span class="pill">Secundaria</span>`;
      // Las principales se pueden editar (nombre/imagen) pero NO borrar.
      const borrar = fija ? "" : `<button class="btn btn--danger btn--xs" data-del-cat="${c.id}">Eliminar</button>`;
      return `
        <tr>
          <td data-label="Foto">${img ? `<img class="thumb" src="${img}" alt="${c.nombre}">` : "—"}</td>
          <td data-label="Nombre"><strong>${c.nombre}</strong></td>
          <td data-label="Descripción">${c.descripcion || "—"}</td>
          <td data-label="Productos">${nProd}</td>
          <td data-label="Tipo">${tipo}</td>
          <td data-label="Acciones" class="acciones">
            <button class="btn btn--ghost btn--xs" data-edit-cat="${c.id}">Editar</button>
            ${borrar}
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-edit-cat]").forEach(b =>
      b.addEventListener("click", () => abrirFormCat(b.dataset.editCat)));
    body.querySelectorAll("[data-del-cat]").forEach(b =>
      b.addEventListener("click", () => eliminarCategoria(b.dataset.delCat)));
  };

  /* Convierte un nombre en un id estable (slug): "Aminoácidos" -> "aminoacidos". */
  const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  /* Genera un id único (slug) que no choque con los ya usados en `lista`. */
  const idUnico = (nombre, lista) => {
    const base = slugify(nombre) || "item";
    let id = base, n = 2;
    while (lista.some(x => x.id === id)) id = `${base}-${n++}`;
    return id;
  };

  /* ---------- Categorías: formulario ---------- */
  const catModal = () => document.getElementById("cat-modal");

  const abrirFormCat = (id) => {
    const c = id ? categorias.find(x => x.id === id) : null;
    document.getElementById("cat-modal-title").textContent = c ? "Editar categoría" : "Agregar categoría";
    document.getElementById("fc-id").value = c ? c.id : "";
    document.getElementById("fc-nombre").value = c ? c.nombre : "";
    document.getElementById("fc-desc").value = c ? (c.descripcion || "") : "";
    document.getElementById("fc-foto").value = "";

    const prev = document.getElementById("fc-preview");
    if (c && c.imagen_url) { prev.src = c.imagen_url; prev.hidden = false; }
    else { prev.hidden = true; prev.removeAttribute("src"); }

    catModal().classList.add("is-open");
  };

  const cerrarFormCat = () => catModal().classList.remove("is-open");

  const initFormCat = () => {
    document.getElementById("btn-cancel-cat").addEventListener("click", cerrarFormCat);

    // Vista previa al elegir imagen.
    document.getElementById("fc-foto").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      const prev = document.getElementById("fc-preview");
      if (!f) return;
      prev.src = URL.createObjectURL(f);
      prev.hidden = false;
    });

    document.getElementById("cat-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-save-cat");
      const id = document.getElementById("fc-id").value;
      const nombre = document.getElementById("fc-nombre").value.trim();
      const descripcion = document.getElementById("fc-desc").value.trim();
      const file = document.getElementById("fc-foto").files[0];
      if (!nombre) { toast("Escribe el nombre de la categoría."); return; }

      btn.disabled = true; btn.textContent = "Guardando…";
      try {
        // Reusa la subida al bucket del formulario de productos.
        let imagen_url;
        if (file) imagen_url = await subirFoto(file);

        if (id) {
          // El id (slug) es la clave que referencian los productos: NO se cambia.
          // La imagen solo se actualiza si se eligió una nueva (si no, se conserva).
          const patch = { nombre, descripcion };
          if (imagen_url) patch.imagen_url = imagen_url;
          const { error } = await sb.from("categorias").update(patch).eq("id", id);
          if (error) throw error;
          toast("Categoría actualizada.");
        } else {
          const { error } = await sb.from("categorias").insert({
            id: idUnico(nombre, categorias), nombre, descripcion,
            imagen_url: imagen_url || null, orden: categorias.length
          });
          if (error) throw error;
          toast("Categoría agregada. Ya está en la tienda.");
        }
        cerrarFormCat();
        await cargarDatos();
      } catch (err) {
        toast("Error: " + (err.message || err));
      } finally {
        btn.disabled = false; btn.textContent = "Guardar categoría";
      }
    });
  };

  /* ---------- Categorías: eliminar ---------- */
  const eliminarCategoria = async (id) => {
    if (esPrincipal(id)) { toast("Las categorías principales no se pueden eliminar."); return; }
    const c = categorias.find(x => x.id === id);
    const nProd = productos.filter(p => p.categoria_id === id).length;
    const aviso = nProd
      ? ` Sus ${nProd} producto${nProd !== 1 ? "s" : ""} quedarán SIN categoría (no se borran, pero dejarán de aparecer en una página de categoría).`
      : "";
    const ok = await Confirm.show("Eliminar categoría",
      `Esta acción no se puede deshacer. ¿Eliminar "${c ? c.nombre : ""}"?${aviso}`, "Sí, eliminar");
    if (!ok) return;
    const { error } = await sb.from("categorias").delete().eq("id", id);
    if (error) { toast("Error al eliminar: " + error.message); return; }
    toast("Categoría eliminada.");
    await cargarDatos();
  };

  /* ---------- Marcas: tabla ---------- */
  const pintarTablaMarcas = () => {
    const body = document.getElementById("marca-tabla-body");
    if (!body) return;
    if (!marcas.length) {
      body.innerHTML = `<tr><td colspan="3" class="muted">No hay marcas. Pulsa "+ Agregar marca".</td></tr>`;
      return;
    }
    body.innerHTML = marcas.map(m => {
      const nProd = productos.filter(p => p.marca_id === m.id).length;
      return `
        <tr>
          <td data-label="Nombre"><strong>${m.nombre}</strong></td>
          <td data-label="Productos">${nProd}</td>
          <td data-label="Acciones" class="acciones">
            <button class="btn btn--ghost btn--xs" data-edit-marca="${m.id}">Editar</button>
            <button class="btn btn--danger btn--xs" data-del-marca="${m.id}">Eliminar</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-edit-marca]").forEach(b =>
      b.addEventListener("click", () => abrirFormMarca(b.dataset.editMarca)));
    body.querySelectorAll("[data-del-marca]").forEach(b =>
      b.addEventListener("click", () => eliminarMarca(b.dataset.delMarca)));
  };

  /* ---------- Marcas: formulario ---------- */
  const marcaModal = () => document.getElementById("marca-modal");

  const abrirFormMarca = (id) => {
    const m = id ? marcas.find(x => x.id === id) : null;
    document.getElementById("marca-modal-title").textContent = m ? "Editar marca" : "Agregar marca";
    document.getElementById("fm-id").value = m ? m.id : "";
    document.getElementById("fm-nombre").value = m ? m.nombre : "";
    marcaModal().classList.add("is-open");
  };

  const cerrarFormMarca = () => marcaModal().classList.remove("is-open");

  const initFormMarca = () => {
    document.getElementById("btn-cancel-marca").addEventListener("click", cerrarFormMarca);

    document.getElementById("marca-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-save-marca");
      const id = document.getElementById("fm-id").value;
      const nombre = document.getElementById("fm-nombre").value.trim();
      if (!nombre) { toast("Escribe el nombre de la marca."); return; }

      btn.disabled = true; btn.textContent = "Guardando…";
      try {
        if (id) {
          const { error } = await sb.from("marcas").update({ nombre }).eq("id", id);
          if (error) throw error;
          toast("Marca actualizada.");
        } else {
          const { error } = await sb.from("marcas").insert({
            id: idUnico(nombre, marcas), nombre, orden: marcas.length
          });
          if (error) throw error;
          toast("Marca agregada.");
        }
        cerrarFormMarca();
        await cargarDatos();
      } catch (err) {
        toast("Error: " + (err.message || err));
      } finally {
        btn.disabled = false; btn.textContent = "Guardar marca";
      }
    });
  };

  /* ---------- Marcas: eliminar ---------- */
  const eliminarMarca = async (id) => {
    const m = marcas.find(x => x.id === id);
    const nProd = productos.filter(p => p.marca_id === id).length;
    const aviso = nProd
      ? ` Sus ${nProd} producto${nProd !== 1 ? "s" : ""} quedarán SIN marca (no se borran).`
      : "";
    const ok = await Confirm.show("Eliminar marca",
      `Esta acción no se puede deshacer. ¿Eliminar "${m ? m.nombre : ""}"?${aviso}`, "Sí, eliminar");
    if (!ok) return;
    const { error } = await sb.from("marcas").delete().eq("id", id);
    if (error) { toast("Error al eliminar: " + error.message); return; }
    toast("Marca eliminada.");
    await cargarDatos();
  };

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
          <td data-label="Foto"><img class="thumb" src="${p.imagen_url || ""}" alt="${p.nombre}"></td>
          <td data-label="Nombre"><strong>${p.nombre}</strong></td>
          <td data-label="Categoría">${nombreCat(p.categoria_id)}${p.marca_id ? ` · ${nombreMarca(p.marca_id)}` : ""}</td>
          <td data-label="Normal">${fmt(p.precio_anterior || p.precio)}</td>
          <td data-label="Promo">${p.precio_anterior ? `<span class="promo-tag">${fmt(p.precio)}</span>` : "—"}</td>
          <td data-label="Dónde aparece" class="celda-secciones">${secciones.join(" ")}</td>
          <td data-label="Acciones" class="acciones">
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
    const selMarca = document.getElementById("f-marca");
    if (selMarca) selMarca.value = (p && p.marca_id) ? p.marca_id : "";
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
    // El formulario SOLO se cierra con "Cancelar" (no al hacer clic fuera),
    // para no perder lo que se está escribiendo por accidente.
    document.getElementById("btn-cancel").addEventListener("click", cerrarForm);

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
      const marca_sel = document.getElementById("f-marca");
      const marca_id = (marca_sel && marca_sel.value) ? marca_sel.value : null;
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
          const patch = { nombre, descripcion, precio, precio_anterior, categoria_id, marca_id, destacado, en_ofertas };
          if (imagen_url) patch.imagen_url = imagen_url;
          const { error } = await sb.from("productos").update(patch).eq("id", id);
          if (error) throw error;
          toast("Producto actualizado.");
        } else {
          const { error } = await sb.from("productos").insert({
            nombre, descripcion, precio, precio_anterior, categoria_id, marca_id,
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
    initFormCat();
    initFormMarca();
    document.getElementById("btn-add").addEventListener("click", () => abrirForm(null));
    document.getElementById("btn-add-cat").addEventListener("click", () => abrirFormCat(null));
    document.getElementById("btn-add-marca").addEventListener("click", () => abrirFormMarca(null));
    document.getElementById("btn-logout").addEventListener("click", logout);

    // Botones "✕" para cerrar cada modal.
    document.getElementById("prod-close").addEventListener("click", cerrarForm);
    document.getElementById("cat-close").addEventListener("click", cerrarFormCat);
    document.getElementById("marca-close").addEventListener("click", cerrarFormMarca);

    // ¿Ya hay sesión iniciada?
    const { data } = await sb.auth.getSession();
    if (data && data.session) mostrarPanel();
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", Admin.init);
