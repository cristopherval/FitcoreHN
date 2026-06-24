/* =========================================================================
   adminmode.js  —  Modo administrador "inline" sobre las páginas reales
   -------------------------------------------------------------------------
   El público ve la tienda normal. Tras iniciar sesión en admin.html se
   guarda una sesión y, al volver al sitio, aparece:
     · una barra superior de administrador,
     · botones de editar/eliminar en cada producto y categoría,
     · botones para agregar producto/categoría.
   Toda edición o borrado pide confirmación (Confirm). Los cambios se
   guardan en el Store y la página se recarga para reflejarlos.
   ========================================================================= */

const AdminMode = (() => {
  const KEY = "fitcore_admin_session";

  const activo = () => sessionStorage.getItem(KEY) === "1";
  const salir = () => { sessionStorage.removeItem(KEY); location.href = "index.html"; };

  /* HTML de los controles que se inyectan en cada tarjeta editable.
     `tipo` = "producto" | "categoria". Solo aparece en modo admin. */
  const controles = (tipo, id) => activo()
    ? `<div class="admin-ctrl">
         <button class="admin-ctrl__btn" data-admin-edit="${tipo}" data-id="${id}" title="Editar" aria-label="Editar"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
         <button class="admin-ctrl__btn admin-ctrl__btn--del" data-admin-del="${tipo}" data-id="${id}" title="Eliminar" aria-label="Eliminar"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg></button>
       </div>`
    : "";

  /* ---- Barra superior ---- */
  const crearBarra = () => {
    const bar = document.createElement("div");
    bar.className = "admin-bar";
    bar.innerHTML = `
      <span class="admin-bar__tag">● Admin · vista previa local</span>
      <div class="admin-bar__actions">
        <button class="btn btn--accent btn--xs" data-admin-add="producto">+ Producto</button>
        <button class="btn btn--accent btn--xs" data-admin-add="categoria">+ Categoría</button>
        <button class="btn btn--accent btn--xs" data-admin-add="testimonio">+ Comentario</button>
        <button class="btn btn--outline btn--xs" data-admin-table>Tabla</button>
        <button class="btn btn--ghost btn--xs" data-admin-pass>Clave</button>
        <button class="btn btn--ghost btn--xs" data-admin-reset>Descartar</button>
        <button class="btn btn--outline btn--xs" data-admin-exit>Salir</button>
      </div>`;
    document.body.appendChild(bar);
  };

  /* ---- Modal de formulario (creado bajo demanda) ---- */
  let modal;
  const crearModal = () => {
    modal = document.createElement("div");
    modal.className = "modal admin-modal";
    modal.innerHTML = `<div class="modal__box"><div id="admin-form-host"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });
  };
  const abrir = (html) => { document.getElementById("admin-form-host").innerHTML = html; modal.classList.add("is-open"); };
  const cerrar = () => modal.classList.remove("is-open");

  const esc = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;");

  const leerImagen = (input) => new Promise((res) => {
    const f = input.files && input.files[0];
    if (!f) return res(null);
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(f);
  });

  /* ---- Producto ---- */
  const formProducto = (p) => {
    const opts = Store.getCategorias()
      .map(c => `<option value="${c.id}" ${p && p.categoria === c.id ? "selected" : ""}>${c.nombre}</option>`).join("");
    return `
      <h3 class="modal__title">${p ? "Editar" : "Agregar"} producto</h3>
      <form id="af-prod" class="form form--grid">
        <div class="form__row form__row--full"><label>Nombre</label><input id="af-nombre" required value="${esc(p && p.nombre)}"></div>
        <div class="form__row"><label>Categoría</label><select id="af-cat">${opts}</select></div>
        <div class="form__row"><label>Precio normal (L.)</label><input id="af-normal" type="number" min="0" required value="${p ? (p.precioAnterior || p.precio) : ""}"></div>
        <div class="form__row"><label>Precio promo (opcional)</label><input id="af-promo" type="number" min="0" value="${p && p.precioAnterior ? p.precio : ""}"></div>
        <div class="form__row form__row--check"><label><input id="af-dest" type="checkbox" ${p && p.destacado ? "checked" : ""}> Mostrar en "más vendidos"</label></div>
        <div class="form__row form__row--full"><label>Descripción</label><textarea id="af-desc" rows="2">${esc(p && p.descripcion)}</textarea></div>
        <div class="form__row form__row--full"><label>Foto ${p ? "(vacío = conservar la actual)" : ""}</label><input id="af-img" type="file" accept="image/*"></div>
        <div class="form__actions form__row--full">
          <button type="submit" class="btn btn--accent">Guardar</button>
          <button type="button" class="btn btn--ghost" data-admin-cancel>Cancelar</button>
        </div>
      </form>`;
  };

  const abrirProducto = (id) => {
    const p = id ? Store.getProducto(id) : null;
    abrir(formProducto(p));
    document.querySelector("[data-admin-cancel]").onclick = cerrar;
    document.getElementById("af-prod").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("af-nombre").value.trim();
      const categoria = document.getElementById("af-cat").value;
      const normal = Number(document.getElementById("af-normal").value);
      const promoRaw = document.getElementById("af-promo").value;
      const promo = promoRaw ? Number(promoRaw) : null;
      const destacado = document.getElementById("af-dest").checked;
      const descripcion = document.getElementById("af-desc").value.trim();
      if (!nombre || !normal || !categoria) { alert("Completa nombre, precio normal y categoría."); return; }
      // Mapeo a la estructura interna: si hay promo válida, ese es el precio
      // de venta y el normal queda como "precio anterior" (tachado con % off).
      let precio, precioAnterior;
      if (promo && promo < normal) { precio = promo; precioAnterior = normal; }
      else { precio = normal; precioAnterior = null; }
      const nuevaImg = await leerImagen(document.getElementById("af-img"));
      const productos = Store.getProductos();
      if (p) {
        const ok = await Confirm.show("Guardar cambios", `¿Guardar los cambios de "${nombre}"?`, "Sí, guardar");
        if (!ok) return;
        const ref = productos.find(x => x.id === id);
        Object.assign(ref, { nombre, categoria, precio, precioAnterior, destacado, descripcion });
        if (nuevaImg) ref.imagen = nuevaImg;
      } else {
        productos.push({ id: Store.nuevoId("p"), nombre, categoria, precio, precioAnterior, destacado, descripcion, imagen: nuevaImg || "assets/atleta-espalda.png" });
      }
      Store.setProductos(productos);
      location.reload();
    });
  };

  const eliminarProducto = async (id) => {
    const p = Store.getProducto(id);
    const ok = await Confirm.show("Eliminar producto", `Esta acción no se puede deshacer. ¿Eliminar "${p ? p.nombre : ""}"?`, "Sí, eliminar");
    if (!ok) return;
    Store.setProductos(Store.getProductos().filter(x => x.id !== id));
    location.reload();
  };

  /* ---- Categoría ---- */
  const formCategoria = (c) => `
    <h3 class="modal__title">${c ? "Editar" : "Agregar"} categoría</h3>
    <form id="af-cat-form" class="form">
      <div class="form__row"><label>Nombre</label><input id="afc-nombre" required value="${esc(c && c.nombre)}"></div>
      <div class="form__row"><label>Descripción</label><input id="afc-desc" value="${esc(c && c.descripcion)}"></div>
      <div class="form__actions">
        <button type="submit" class="btn btn--accent">Guardar</button>
        <button type="button" class="btn btn--ghost" data-admin-cancel>Cancelar</button>
      </div>
    </form>`;

  const abrirCategoria = (id) => {
    const c = id ? Store.getCategorias().find(x => x.id === id) : null;
    abrir(formCategoria(c));
    document.querySelector("[data-admin-cancel]").onclick = cerrar;
    document.getElementById("af-cat-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("afc-nombre").value.trim();
      const desc = document.getElementById("afc-desc").value.trim();
      if (!nombre) { alert("Escribe el nombre de la categoría."); return; }
      const cats = Store.getCategorias();
      if (c) {
        const ok = await Confirm.show("Guardar cambios", `¿Guardar los cambios de "${nombre}"?`, "Sí, guardar");
        if (!ok) return;
        const ref = cats.find(x => x.id === id);
        ref.nombre = nombre; ref.descripcion = desc;
      } else {
        let b = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        let nid = b || Store.nuevoId("cat");
        while (cats.some(x => x.id === nid)) nid = `${b}-${Store.nuevoId("x")}`;
        cats.push({ id: nid, nombre, descripcion: desc });
      }
      Store.setCategorias(cats);
      location.reload();
    });
  };

  const eliminarCategoria = async (id) => {
    const c = Store.getCategorias().find(x => x.id === id);
    const enUso = Store.getProductos().filter(p => p.categoria === id).length;
    let msg = `¿Eliminar la categoría "${c ? c.nombre : ""}"?`;
    if (enUso) msg += ` Tiene ${enUso} producto(s) que quedarán sin categoría visible.`;
    const ok = await Confirm.show("Eliminar categoría", msg, "Sí, eliminar");
    if (!ok) return;
    Store.setCategorias(Store.getCategorias().filter(x => x.id !== id));
    location.reload();
  };

  /* ---- Testimonio (comentario) ---- */
  const formTestimonio = (t) => `
    <h3 class="modal__title">${t ? "Editar" : "Agregar"} comentario</h3>
    <form id="af-testi" class="form form--grid">
      <div class="form__row"><label>Nombre</label><input id="aft-nombre" required value="${esc(t && t.nombre)}"></div>
      <div class="form__row"><label>Ciudad</label><input id="aft-ciudad" value="${esc(t && t.ciudad)}"></div>
      <div class="form__row"><label>Estrellas</label>
        <select id="aft-estrellas">${[5,4,3,2,1].map(n => `<option value="${n}" ${t && t.estrellas === n ? "selected" : ""}>${n} estrellas</option>`).join("")}</select>
      </div>
      <div class="form__row form__row--full"><label>Comentario</label><textarea id="aft-texto" rows="3" required>${esc(t && t.texto)}</textarea></div>
      <div class="form__actions form__row--full">
        <button type="submit" class="btn btn--accent">Guardar</button>
        <button type="button" class="btn btn--ghost" data-admin-cancel>Cancelar</button>
      </div>
    </form>`;

  const abrirTestimonio = (idx) => {
    const lista = Store.getTestimonios();
    const t = (idx != null && idx >= 0) ? lista[idx] : null;
    abrir(formTestimonio(t));
    document.querySelector("[data-admin-cancel]").onclick = cerrar;
    document.getElementById("af-testi").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("aft-nombre").value.trim();
      const ciudad = document.getElementById("aft-ciudad").value.trim();
      const estrellas = Number(document.getElementById("aft-estrellas").value);
      const texto = document.getElementById("aft-texto").value.trim();
      if (!nombre || !texto) { alert("Completa nombre y comentario."); return; }
      const arr = Store.getTestimonios();
      if (t) {
        const ok = await Confirm.show("Guardar cambios", "¿Guardar los cambios de este comentario?", "Sí, guardar");
        if (!ok) return;
        arr[idx] = { nombre, ciudad, estrellas, texto };
      } else {
        arr.push({ nombre, ciudad, estrellas, texto });
      }
      Store.setTestimonios(arr);
      location.reload();
    });
  };

  const eliminarTestimonio = async (idx) => {
    const ok = await Confirm.show("Eliminar comentario", "¿Eliminar este comentario? No se puede deshacer.", "Sí, eliminar");
    if (!ok) return;
    const arr = Store.getTestimonios();
    arr.splice(idx, 1);
    Store.setTestimonios(arr);
    location.reload();
  };

  /* ---- Tabla de gestión de productos (ID, nombre, precios) ---- */
  let tablaEl;
  const fmtL = (n) => (n == null || n === "") ? "—" : `L. ${Number(n).toLocaleString("es-HN")}`;

  const crearTabla = () => {
    tablaEl = document.createElement("div");
    tablaEl.className = "modal admin-table-modal";
    tablaEl.innerHTML = `
      <div class="modal__box modal__box--wide">
        <div class="admin-table-head">
          <h3 class="modal__title">Productos</h3>
          <button class="admin-table-x" data-tabla-close aria-label="Cerrar">✕</button>
        </div>
        <div class="admin-table-actions">
          <button class="btn btn--accent btn--sm" data-admin-add="producto">+ Producto</button>
          <button class="btn btn--outline btn--sm" data-tabla-copy>Copiar para data.js</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Normal</th><th>Promo</th><th>Acciones</th></tr></thead>
            <tbody id="admin-tabla-body"></tbody>
          </table>
        </div>
        <p class="admin-table-note">Estos cambios son <strong>vista previa local</strong>. Para publicarlos a todos: usa <em>"Copiar para data.js"</em>, pega en <code>js/data.js</code> y sube a GitHub.</p>
      </div>`;
    document.body.appendChild(tablaEl);
    tablaEl.querySelector("[data-tabla-close]").onclick = cerrarTabla;
    tablaEl.querySelector("[data-tabla-copy]").onclick = copiarParaData;
    tablaEl.addEventListener("click", (e) => { if (e.target === tablaEl) cerrarTabla(); });
  };

  const renderTabla = () => {
    const body = document.getElementById("admin-tabla-body");
    if (!body) return;
    const prods = Store.getProductos();
    body.innerHTML = prods.length ? prods.map(p => {
      const normal = p.precioAnterior || p.precio;
      const promo = p.precioAnterior ? p.precio : null;
      return `<tr>
        <td><code>${p.id}</code></td>
        <td>${p.nombre}</td>
        <td>${fmtL(normal)}</td>
        <td>${promo ? `<span class="promo-tag">${fmtL(promo)}</span>` : "—"}</td>
        <td class="acciones">
          <button class="btn btn--ghost btn--xs" data-admin-edit="producto" data-id="${p.id}">Editar</button>
          <button class="btn btn--danger btn--xs" data-admin-del="producto" data-id="${p.id}">Eliminar</button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="5" class="muted">Sin productos.</td></tr>`;
  };

  const abrirTabla = () => {
    if (!tablaEl) crearTabla();
    renderTabla();
    tablaEl.classList.add("is-open");
    sessionStorage.setItem("fitcore_admin_table", "1"); // se reabre tras recargar
  };
  const cerrarTabla = () => {
    if (tablaEl) tablaEl.classList.remove("is-open");
    sessionStorage.removeItem("fitcore_admin_table");
  };

  // Copia el arreglo de productos listo para pegar en js/data.js.
  const copiarParaData = async () => {
    const prods = Store.getProductos();
    const txt = "const DEFAULT_PRODUCTOS = " + JSON.stringify(prods, null, 2) + ";";
    try {
      await navigator.clipboard.writeText(txt);
      alert("✅ Copiado.\n\nEn VS Code abre js/data.js, reemplaza el bloque DEFAULT_PRODUCTOS por lo copiado y haz commit + push.");
    } catch (e) {
      window.prompt("Copia este texto y pégalo en js/data.js (reemplaza DEFAULT_PRODUCTOS):", txt);
    }
  };

  /* ---- Clave y reset ---- */
  const cambiarClave = () => {
    const n = prompt("Nueva contraseña de administrador (mínimo 4 caracteres):");
    if (n == null) return;
    if (n.length < 4) { alert("Mínimo 4 caracteres."); return; }
    Store.setPass(n);
    alert("Contraseña actualizada.");
  };
  const resetCatalogo = async () => {
    const ok = await Confirm.show("Descartar cambios locales",
      "Se descartan tus cambios de vista previa y vuelves a lo publicado en data.js. ¿Continuar?", "Sí, descartar");
    if (!ok) return;
    Store.descartarLocal();
    location.reload();
  };

  /* ---- Delegación de clics ---- */
  const wire = () => {
    document.body.addEventListener("click", (e) => {
      const add  = e.target.closest("[data-admin-add]");
      const edit = e.target.closest("[data-admin-edit]");
      const del  = e.target.closest("[data-admin-del]");
      if (add) {
        e.preventDefault();
        const t = add.dataset.adminAdd;
        if (t === "producto") abrirProducto(null);
        else if (t === "categoria") abrirCategoria(null);
        else if (t === "testimonio") abrirTestimonio(null);
        return;
      }
      if (edit) {
        e.preventDefault(); e.stopPropagation();
        const t = edit.dataset.adminEdit, id = edit.dataset.id;
        if (t === "producto") abrirProducto(id);
        else if (t === "categoria") abrirCategoria(id);
        else if (t === "testimonio") abrirTestimonio(Number(id));
        return;
      }
      if (del) {
        e.preventDefault(); e.stopPropagation();
        const t = del.dataset.adminDel, id = del.dataset.id;
        if (t === "producto") eliminarProducto(id);
        else if (t === "categoria") eliminarCategoria(id);
        else if (t === "testimonio") eliminarTestimonio(Number(id));
        return;
      }
      if (e.target.closest("[data-admin-table]")) { e.preventDefault(); abrirTabla(); }
      if (e.target.closest("[data-admin-exit]"))  { e.preventDefault(); salir(); }
      if (e.target.closest("[data-admin-pass]"))  { e.preventDefault(); cambiarClave(); }
      if (e.target.closest("[data-admin-reset]")) { e.preventDefault(); resetCatalogo(); }
    });
  };

  const init = () => {
    if (!activo()) return;
    document.body.classList.add("admin-on");
    crearBarra();
    crearModal();
    wire();
    // Reabre la tabla si estaba abierta antes de recargar (tras editar/guardar).
    if (sessionStorage.getItem("fitcore_admin_table") === "1") abrirTabla();
  };

  document.addEventListener("DOMContentLoaded", init);

  return { activo, controles };
})();
