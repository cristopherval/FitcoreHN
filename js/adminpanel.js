/* =========================================================================
   adminpanel.js  —  Panel de administración (solo productos)
   -------------------------------------------------------------------------
   Al iniciar sesión muestra una TABLA con todos los productos (ID, nombre,
   categoría, precio normal y precio promo) y permite editarlos, agregarlos
   o eliminarlos. Los cambios son una VISTA PREVIA local; para publicarlos a
   todos los visitantes se usa "Publicar" → pegar en js/data.js → push.
   ========================================================================= */

const AdminPanel = (() => {
  const SES = "fitcore_admin_session";
  const fmt = (n) => (n == null || n === "") ? "—" : `L. ${Number(n).toLocaleString("es-HN")}`;
  const esc = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;");

  /* ---------- Login ---------- */
  const initLogin = () => {
    const form = document.getElementById("login-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const pass = document.getElementById("login-pass").value;
      if (pass === Store.getPass()) {
        sessionStorage.setItem(SES, "1");
        mostrarPanel();
      } else {
        const er = document.getElementById("login-error");
        er.textContent = "Contraseña incorrecta.";
        er.classList.add("is-visible");
      }
    });
    // Si ya hay sesión en esta pestaña, entra directo.
    if (sessionStorage.getItem(SES) === "1") mostrarPanel();
  };

  const mostrarPanel = () => {
    // display inline para ocultar el login con seguridad (su .admin-login usa
    // display:grid, que ignoraría el atributo [hidden]).
    document.getElementById("login-view").style.display = "none";
    const panel = document.getElementById("panel-view");
    panel.hidden = false;
    panel.style.display = "block";
    document.getElementById("btn-add").onclick = () => abrirForm(null);
    document.getElementById("btn-copy").onclick = publicar;
    document.getElementById("btn-discard").onclick = descartar;
    document.getElementById("btn-logout").onclick = () => { sessionStorage.removeItem(SES); location.reload(); };
    // Espera a que cargue data.json antes de pintar la tabla.
    (Store.ready || Promise.resolve()).then(render);
  };

  const nombreCat = (id) => {
    const c = Store.getCategorias().find(x => x.id === id);
    return c ? c.nombre : "—";
  };

  /* ---------- Tabla ---------- */
  const render = () => {
    const body = document.getElementById("tabla-body");
    const prods = Store.getProductos();
    body.innerHTML = prods.length ? prods.map(p => {
      const normal = p.precioAnterior || p.precio;       // precio regular
      const promo = p.precioAnterior ? p.precio : null;  // precio de oferta (si hay)
      return `<tr>
        <td><code>${p.id}</code></td>
        <td><img class="thumb" src="${p.imagen}" alt="" loading="lazy"></td>
        <td>${p.nombre}</td>
        <td>${nombreCat(p.categoria)}</td>
        <td>${fmt(normal)}</td>
        <td>${promo ? `<span class="promo-tag">${fmt(promo)}</span>` : "—"}</td>
        <td>${p.destacado ? `<span class="promo-tag">Sí</span>` : "—"}</td>
        <td class="acciones">
          <button class="btn btn--ghost btn--xs" data-edit="${p.id}">Editar</button>
          <button class="btn btn--danger btn--xs" data-del="${p.id}">Eliminar</button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="8" class="muted">No hay productos. Agrega uno con "Agregar producto".</td></tr>`;

    body.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => abrirForm(b.dataset.edit));
    body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => eliminar(b.dataset.del));
  };

  /* ---------- Modal de formulario ---------- */
  let modal;
  const ensureModal = () => {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "modal admin-modal";
    modal.innerHTML = `<div class="modal__box"><div id="form-host"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });
  };
  const cerrar = () => modal.classList.remove("is-open");

  const leerImg = (input) => new Promise((res) => {
    const f = input.files && input.files[0];
    if (!f) return res(null);
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(f);
  });

  const abrirForm = (id) => {
    ensureModal();
    const p = id ? Store.getProducto(id) : null;
    const opts = Store.getCategorias()
      .map(c => `<option value="${c.id}" ${p && p.categoria === c.id ? "selected" : ""}>${c.nombre}</option>`).join("");

    document.getElementById("form-host").innerHTML = `
      <h3 class="modal__title">${p ? "Editar" : "Agregar"} producto</h3>
      <form id="prod-form" class="form form--grid">
        <div class="form__row form__row--full"><label>Nombre</label><input id="f-nombre" required value="${esc(p && p.nombre)}"></div>
        <div class="form__row"><label>Categoría</label><select id="f-cat">${opts}</select></div>
        <div class="form__row"><label>Precio normal (L.)</label><input id="f-normal" type="number" min="0" required value="${p ? (p.precioAnterior || p.precio) : ""}"></div>
        <div class="form__row"><label>Precio promo (opcional)</label><input id="f-promo" type="number" min="0" value="${p && p.precioAnterior ? p.precio : ""}"></div>
        <div class="form__row form__row--check"><label><input id="f-dest" type="checkbox" ${p && p.destacado ? "checked" : ""}> Mostrar en "más vendidos"</label></div>
        <div class="form__row form__row--full"><label>Descripción</label><textarea id="f-desc" rows="2">${esc(p && p.descripcion)}</textarea></div>
        <div class="form__row form__row--full"><label>Foto ${p ? "(vacío = conservar la actual)" : ""}</label><input id="f-img" type="file" accept="image/*"></div>
        <div class="form__actions form__row--full">
          <button class="btn btn--accent" type="submit">Guardar</button>
          <button class="btn btn--ghost" type="button" id="f-cancel">Cancelar</button>
        </div>
      </form>`;
    modal.classList.add("is-open");
    document.getElementById("f-cancel").onclick = cerrar;

    document.getElementById("prod-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("f-nombre").value.trim();
      const categoria = document.getElementById("f-cat").value;
      const normal = Number(document.getElementById("f-normal").value);
      const promoRaw = document.getElementById("f-promo").value;
      const promo = promoRaw ? Number(promoRaw) : null;
      const destacado = document.getElementById("f-dest").checked;
      const descripcion = document.getElementById("f-desc").value.trim();
      if (!nombre || !normal || !categoria) { toast("Completa nombre, precio normal y categoría."); return; }

      // Promo válida → ese es el precio de venta y el normal queda tachado.
      let precio, precioAnterior;
      if (promo && promo < normal) { precio = promo; precioAnterior = normal; }
      else { precio = normal; precioAnterior = null; }

      const nuevaImg = await leerImg(document.getElementById("f-img"));
      const prods = Store.getProductos();
      if (p) {
        const ok = await Confirm.show("Guardar cambios", `¿Guardar los cambios de "${nombre}"?`, "Sí, guardar");
        if (!ok) return;
        const ref = prods.find(x => x.id === id);
        Object.assign(ref, { nombre, categoria, precio, precioAnterior, destacado, descripcion });
        if (nuevaImg) ref.imagen = nuevaImg;
        toast("Producto actualizado.");
      } else {
        prods.push({ id: Store.proximoId("p", prods), nombre, categoria, precio, precioAnterior, destacado, descripcion, imagen: nuevaImg || "assets/atleta-espalda.png" });
        toast("Producto agregado.");
      }
      Store.setProductos(prods);
      cerrar();
      render();
    });
  };

  const eliminar = async (id) => {
    const p = Store.getProducto(id);
    const ok = await Confirm.show("Eliminar producto", `Esta acción no se puede deshacer. ¿Eliminar "${p ? p.nombre : ""}"?`, "Sí, eliminar");
    if (!ok) return;
    Store.setProductos(Store.getProductos().filter(x => x.id !== id));
    render();
    toast("Producto eliminado.");
  };

  /* ---------- Publicar (copiar todo el data.json) ---------- */
  const publicar = async () => {
    const data = {
      productos: Store.getProductos(),
      categorias: Store.getCategorias(),
      testimonios: Store.getTestimonios()
    };
    const txt = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      toast("Copiado. Reemplaza TODO el contenido de data.json con esto y sube a GitHub.");
    } catch (e) {
      window.prompt("Copia esto y reemplaza TODO el contenido de data.json:", txt);
    }
  };

  const descartar = async () => {
    const ok = await Confirm.show("Descartar cambios",
      "Se descartan tus cambios locales y se carga lo publicado en data.js. ¿Continuar?", "Sí, descartar");
    if (!ok) return;
    Store.descartarLocal();
    render();
    toast("Cambios descartados.");
  };

  const toast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-visible");
    setTimeout(() => t.classList.remove("is-visible"), 3000);
  };

  document.addEventListener("DOMContentLoaded", initLogin);
  return {};
})();
