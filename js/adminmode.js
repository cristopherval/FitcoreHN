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
      <span class="admin-bar__tag">● Modo administrador</span>
      <div class="admin-bar__actions">
        <button class="btn btn--accent btn--xs" data-admin-add="producto">+ Producto</button>
        <button class="btn btn--accent btn--xs" data-admin-add="categoria">+ Categoría</button>
        <button class="btn btn--ghost btn--xs" data-admin-pass>Clave</button>
        <button class="btn btn--ghost btn--xs" data-admin-reset>Reset</button>
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
        <div class="form__row"><label>Precio (L.)</label><input id="af-precio" type="number" min="0" required value="${p ? p.precio : ""}"></div>
        <div class="form__row"><label>Precio anterior (oferta)</label><input id="af-precioant" type="number" min="0" value="${p && p.precioAnterior ? p.precioAnterior : ""}"></div>
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
      const precio = Number(document.getElementById("af-precio").value);
      const precioAnt = document.getElementById("af-precioant").value;
      const destacado = document.getElementById("af-dest").checked;
      const descripcion = document.getElementById("af-desc").value.trim();
      if (!nombre || !precio || !categoria) { alert("Completa nombre, precio y categoría."); return; }
      const nuevaImg = await leerImagen(document.getElementById("af-img"));
      const productos = Store.getProductos();
      if (p) {
        const ok = await Confirm.show("Guardar cambios", `¿Guardar los cambios de "${nombre}"?`, "Sí, guardar");
        if (!ok) return;
        const ref = productos.find(x => x.id === id);
        Object.assign(ref, { nombre, categoria, precio, precioAnterior: precioAnt ? Number(precioAnt) : null, destacado, descripcion });
        if (nuevaImg) ref.imagen = nuevaImg;
      } else {
        productos.push({ id: Store.nuevoId("p"), nombre, categoria, precio, precioAnterior: precioAnt ? Number(precioAnt) : null, destacado, descripcion, imagen: nuevaImg || "assets/atleta-espalda.png" });
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

  /* ---- Clave y reset ---- */
  const cambiarClave = () => {
    const n = prompt("Nueva contraseña de administrador (mínimo 4 caracteres):");
    if (n == null) return;
    if (n.length < 4) { alert("Mínimo 4 caracteres."); return; }
    Store.setPass(n);
    alert("Contraseña actualizada.");
  };
  const resetCatalogo = async () => {
    const ok = await Confirm.show("Restablecer catálogo",
      "Esto restaura el catálogo de ejemplo y borra tus cambios. ¿Continuar?", "Sí, restablecer");
    if (!ok) return;
    Store.setProductos(DEFAULT_PRODUCTOS);
    Store.setCategorias(DEFAULT_CATEGORIAS);
    location.reload();
  };

  /* ---- Delegación de clics ---- */
  const wire = () => {
    document.body.addEventListener("click", (e) => {
      const add  = e.target.closest("[data-admin-add]");
      const edit = e.target.closest("[data-admin-edit]");
      const del  = e.target.closest("[data-admin-del]");
      if (add)  { e.preventDefault(); add.dataset.adminAdd === "producto" ? abrirProducto(null) : abrirCategoria(null); return; }
      if (edit) { e.preventDefault(); e.stopPropagation(); edit.dataset.adminEdit === "producto" ? abrirProducto(edit.dataset.id) : abrirCategoria(edit.dataset.id); return; }
      if (del)  { e.preventDefault(); e.stopPropagation(); del.dataset.adminDel === "producto" ? eliminarProducto(del.dataset.id) : eliminarCategoria(del.dataset.id); return; }
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
  };

  document.addEventListener("DOMContentLoaded", init);

  return { activo, controles };
})();
