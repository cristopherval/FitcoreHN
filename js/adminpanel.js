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
    // Los pedidos y los envíos los maneja adminpedidos.js (archivo aparte).
    if (typeof AdminPedidos !== "undefined") AdminPedidos.cargar();
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
    pintarFiltroCategorias();
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
      // Eliminar pasó al formulario de edición; en la lista sólo queda abrirlo.
      return `
        <tr>
          <td data-label="Foto">${img ? `<img class="thumb" src="${img}" alt="${c.nombre}">` : "—"}</td>
          <td data-label="Nombre">
            <strong>${c.nombre}</strong>
            <!-- Resumen para móvil, donde la fila se reduce a foto y nombre. -->
            <span class="fila-resumen">
              <span class="fila-precio">${nProd} producto${nProd !== 1 ? "s" : ""}</span>
              ${fija ? `<span class="pill pill--ok">Principal</span>` : ""}
            </span>
          </td>
          <td data-label="Descripción">${c.descripcion || "—"}</td>
          <td data-label="Productos">${nProd}</td>
          <td data-label="Tipo">${tipo}</td>
          <td data-label="Acciones" class="acciones">
            <button class="btn btn--ghost btn--xs" data-edit-cat="${c.id}">Editar</button>
          </td>
        </tr>`;
    }).join("");

    body.querySelectorAll("[data-edit-cat]").forEach(b =>
      b.addEventListener("click", () => abrirFormCat(b.dataset.editCat)));

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


  /* ---------- Selector de icono de categoría ---------- */
  /* Los dibujos viven en js/iconos.js. Agregar uno allá lo hace aparecer
     acá solo, sin tocar este archivo ni el HTML. */

  const pintarIconos = (elegido) => {
    const cont = document.getElementById("fc-iconos");
    if (!cont || typeof ICONOS === "undefined") return;

    const claves = Object.keys(ICONOS);
    const actual = claves.includes(elegido) ? elegido : claves[0];
    document.getElementById("fc-icono").value = actual;

    cont.innerHTML = claves.map(k => `
      <button type="button" class="icon-opt${k === actual ? " is-active" : ""}"
              data-icono="${k}" title="${ICONOS[k].nombre}"
              aria-label="${ICONOS[k].nombre}">
        ${iconoSVG(k, 24)}
      </button>`).join("");

    cont.querySelectorAll("[data-icono]").forEach(b => {
      b.addEventListener("click", () => {
        document.getElementById("fc-icono").value = b.dataset.icono;
        cont.querySelectorAll(".icon-opt").forEach(x =>
          x.classList.toggle("is-active", x === b));
      });
    });
  };
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

    pintarIconos(c ? c.icono : null);

    // Eliminar sólo al editar, y nunca en las tres principales.
    const del = document.getElementById("btn-del-cat");
    if (del) {
      del.hidden = !c || esPrincipal(c.id);
      del.onclick = () => { cerrarFormCat(); eliminarCategoria(c.id); };
    }

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
        // Icono elegido en el selector (clave de js/iconos.js).
        const icono = document.getElementById("fc-icono").value || "bote";

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

  /* Ojo abierto / tachado para el botón de ocultar. Van aquí y no en
     iconos.js porque sólo los usa el panel. */
  const OJO_ABIERTO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>`;
  const OJO_CERRADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a18 18 0 0 1-3.3 4.1"/><path d="M6.4 7.6A17.6 17.6 0 0 0 2 12s3.6 6.5 10 6.5a9.8 9.8 0 0 0 4-.8"/><path d="M9.5 10.3a2.8 2.8 0 0 0 3.9 3.9"/></svg>`;

  /* ---------- Tabla de productos ----------
     Con el catálogo creciendo, una lista en el orden interno de la base no
     sirve para encontrar nada. Aquí se filtra, se ordena y se agrupa antes
     de pintar; todo en memoria, sin volver a consultar la nube. */
  const vista = { orden: "nombre-asc", agrupar: "", buscar: "", cat: "", min: "", max: "" };

  const porNombre = (a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });

  /* El texto que se compara al ordenar/agrupar por categoría o marca.
     "—" (sin asignar) se fuerza al final con un carácter alto. */
  const clave = (p, campo) => {
    const n = campo === "marca" ? nombreMarca(p.marca_id) : nombreCat(p.categoria_id);
    return n === "—" ? "￿" : n;
  };

  const filtrar = (lista) => {
    const q = vista.buscar.trim().toLowerCase();
    const min = vista.min === "" ? null : Number(vista.min);
    const max = vista.max === "" ? null : Number(vista.max);
    return lista.filter(p => {
      if (vista.cat && p.categoria_id !== vista.cat) return false;
      // El precio que se compara es el que paga el cliente (el de promo
      // cuando la hay), que es el que ella ve en la lista.
      if (min !== null && Number(p.precio) < min) return false;
      if (max !== null && Number(p.precio) > max) return false;
      if (!q) return true;
      return p.nombre.toLowerCase().includes(q) ||
             nombreMarca(p.marca_id).toLowerCase().includes(q) ||
             nombreCat(p.categoria_id).toLowerCase().includes(q);
    });
  };

  const ordenar = (lista) => {
    const l = [...lista];
    switch (vista.orden) {
      case "nombre-desc":   return l.sort((a, b) => porNombre(b, a));
      case "precio-asc":    return l.sort((a, b) => a.precio - b.precio || porNombre(a, b));
      case "precio-desc":   return l.sort((a, b) => b.precio - a.precio || porNombre(a, b));
      case "categoria-asc": return l.sort((a, b) => clave(a, "categoria").localeCompare(clave(b, "categoria"), "es") || porNombre(a, b));
      case "marca-asc":     return l.sort((a, b) => clave(a, "marca").localeCompare(clave(b, "marca"), "es") || porNombre(a, b));
      case "reciente":      return l.sort((a, b) => new Date(b.creado_at || 0) - new Date(a.creado_at || 0));
      default:              return l.sort(porNombre);
    }
  };

  const filaProducto = (p) => {
    const secciones = [];
    secciones.push(`<span class="pill">${nombreCat(p.categoria_id)}</span>`);
    if (p.destacado) secciones.push(`<span class="pill pill--ok">Más vendidos</span>`);
    if (p.en_ofertas) secciones.push(`<span class="pill pill--ok">Ofertas</span>`);
    return `
      <tr class="${p.visible === false ? "fila-oculta" : ""}">
        <td data-label="Foto"><img class="thumb" src="${p.imagen_url || ""}" alt="${p.nombre}"></td>
        <td data-label="Nombre">
          <strong>${p.nombre}</strong>
          <!-- Resumen para móvil: ahí la fila sólo muestra foto, nombre y precio. -->
          <span class="fila-resumen">
            <span class="fila-precio">${fmt(p.precio)}</span>
            ${p.precio_anterior ? `<span class="fila-precio--old">${fmt(p.precio_anterior)}</span>` : ""}
            ${p.visible === false ? `<span class="pill pill--off">Oculto</span>` : ""}
          </span>
        </td>
        <td data-label="Categoría">${nombreCat(p.categoria_id)}${p.marca_id ? ` · ${nombreMarca(p.marca_id)}` : ""}</td>
        <td data-label="Normal">${fmt(p.precio_anterior || p.precio)}</td>
        <td data-label="Promo">${p.precio_anterior ? `<span class="promo-tag">${fmt(p.precio)}</span>` : "—"}</td>
        <td data-label="Dónde aparece" class="celda-secciones">${secciones.join(" ")}</td>
        <td data-label="Acciones" class="acciones">
          <button class="btn btn--ghost btn--xs" data-edit="${p.id}">Editar</button>
          <button class="btn-ojo${p.visible === false ? " is-off" : ""}" data-ver="${p.id}"
                  title="${p.visible === false ? "Mostrar en la tienda" : "Ocultar de la tienda"}"
                  aria-label="${p.visible === false ? "Mostrar en la tienda" : "Ocultar de la tienda"}">
            ${p.visible === false ? OJO_CERRADO : OJO_ABIERTO}
          </button>
        </td>
      </tr>`;
  };

  /* Cabecera que separa un grupo del siguiente cuando se agrupa. */
  const filaGrupo = (titulo, n) => `
    <tr class="tabla-grupo">
      <td colspan="7">${titulo} <span class="tabla-grupo__n">${n}</span></td>
    </tr>`;

  const pintarTabla = () => {
    const body = document.getElementById("tabla-body");
    if (!body) return;
    const conteo = document.getElementById("prod-conteo");

    if (!productos.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No hay productos. Pulsa "+ Agregar producto".</td></tr>`;
      if (conteo) conteo.textContent = "";
      return;
    }

    const lista = ordenar(filtrar(productos));

    if (conteo) {
      conteo.textContent = lista.length === productos.length
        ? `${productos.length} producto${productos.length !== 1 ? "s" : ""}`
        : `${lista.length} de ${productos.length}`;
    }

    if (!lista.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">Ningún producto coincide con la búsqueda.</td></tr>`;
      return;
    }

    if (!vista.agrupar) {
      body.innerHTML = lista.map(filaProducto).join("");
    } else {
      // Ya vienen ordenados por ese campo, así que basta con recorrer
      // y abrir una cabecera cada vez que cambia el grupo.
      const campo = vista.agrupar;
      const nombreDe = (p) => campo === "marca" ? nombreMarca(p.marca_id) : nombreCat(p.categoria_id);
      const porGrupo = [...lista].sort((a, b) =>
        clave(a, campo).localeCompare(clave(b, campo), "es") || porNombre(a, b));
      let html = "", actual = null, buffer = [];
      const cerrar = () => {
        if (actual === null) return;
        html += filaGrupo(actual === "—" ? (campo === "marca" ? "Sin marca" : "Sin categoría") : actual, buffer.length);
        html += buffer.join("");
        buffer = [];
      };
      porGrupo.forEach(p => {
        const g = nombreDe(p);
        if (g !== actual) { cerrar(); actual = g; }
        buffer.push(filaProducto(p));
      });
      cerrar();
      body.innerHTML = html;
    }

    body.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    body.querySelectorAll("[data-ver]").forEach(b =>
      b.addEventListener("click", () => alternarVisible(b.dataset.ver)));
  };

  /* La lista de categorías del filtro se rellena con las que existen. */
  const pintarFiltroCategorias = () => {
    const sel = document.getElementById("prod-filtro-cat");
    if (!sel) return;
    const elegida = vista.cat;
    sel.innerHTML = `<option value="">Todas</option>` +
      categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
    // Si la categoría elegida se borró, el filtro vuelve a "Todas".
    sel.value = categorias.some(c => c.id === elegida) ? elegida : "";
    vista.cat = sel.value;
  };

  /* Los controles de la barra sólo redibujan: no tocan la base. */
  const initControlesTabla = () => {
    const enlazar = (id, evento, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evento, () => { fn(el.value); pintarTabla(); });
    };
    enlazar("prod-orden", "change", v => vista.orden = v);
    enlazar("prod-agrupar", "change", v => vista.agrupar = v);
    enlazar("prod-buscar", "input", v => vista.buscar = v);
    enlazar("prod-filtro-cat", "change", v => vista.cat = v);
    enlazar("prod-min", "input", v => vista.min = v);
    enlazar("prod-max", "input", v => vista.max = v);

    // En escritorio hay sitio de sobra: los filtros arrancan abiertos. En
    // celular se quedan plegados para que la lista empiece arriba.
    const filtrador = document.getElementById("prod-filtrador");
    if (filtrador && window.innerWidth > 900) filtrador.open = true;
  };


  /* Enciende o apaga un producto en la tienda. Es un solo campo, así que se
     actualiza directo y se refleja al instante sin recargar todo. */
  const alternarVisible = async (id) => {
    const p = productos.find(x => String(x.id) === String(id));
    if (!p) return;
    const nuevo = p.visible === false;   // si estaba oculto, se muestra
    const { error } = await sb.from("productos").update({ visible: nuevo }).eq("id", id);
    if (error) {
      // Si todavía no se corrió el SQL que agrega la columna, se avisa claro.
      toast(/visible/i.test(error.message)
        ? "Falta agregar la columna \"visible\" en la base (productos-visible.sql)."
        : "No se pudo cambiar: " + error.message);
      return;
    }
    p.visible = nuevo;
    toast(nuevo ? "Producto visible en la tienda." : "Producto oculto de la tienda.");
    pintarTabla();
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

    // Carga la galeria del producto (vacia y deshabilitada si es nuevo).
    galEstado("");
    galCargar(p ? p.id : null);

    // Eliminar sólo tiene sentido sobre un producto que ya existe.
    const del = document.getElementById("btn-del");
    if (del) {
      del.hidden = !p;
      del.onclick = () => { cerrarForm(); eliminar(p.id); };
    }

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


  /* ================= GALERÍA DE IMÁGENES ================= */
  /* Son las fotos EXTRA del producto (vistas, sabores, tabla nutricional).
     La foto principal sigue siendo productos.imagen_url; esto la complementa.
     Solo se puede usar al editar, porque las imágenes se cuelgan de un id
     de producto que un producto nuevo todavía no tiene. */

  let galImagenes = [];
  let galProductoId = null;

  const galEstado = (txt) => {
    const el = document.getElementById("gal-estado");
    if (el) el.textContent = txt || "";
  };

  const galCargar = async (productoId) => {
    galProductoId = productoId || null;
    const zona = document.getElementById("gal-zona");
    const aviso = document.getElementById("gal-aviso");

    // Producto nuevo: no hay dónde guardar las fotos todavía.
    if (!galProductoId) {
      zona.hidden = true; aviso.hidden = false;
      galImagenes = []; return;
    }
    zona.hidden = false; aviso.hidden = true;

    const { data, error } = await sb.from("producto_imagenes")
      .select("*").eq("producto_id", galProductoId)
      .order("orden", { ascending: true });

    if (error) { galEstado("No se pudieron cargar las imágenes."); galImagenes = []; }
    else galImagenes = data || [];
    galPintar();
  };

  const galPintar = () => {
    const cont = document.getElementById("gal-lista");
    if (!cont) return;

    if (!galImagenes.length) {
      cont.innerHTML = `<p class="muted">Sin imágenes extra todavía.</p>`;
      return;
    }

    cont.innerHTML = galImagenes.map((im, i) => `
      <div class="admin-gal__item" data-id="${im.id}">
        <img src="${im.url}" alt="">
        <input type="text" class="admin-inline" data-alt value="${(im.alt || "").replace(/"/g, "&quot;")}"
               placeholder="Qué se ve (ej. tabla nutricional)">
        <div class="admin-gal__acciones">
          <button type="button" data-sube title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-baja title="Bajar" ${i === galImagenes.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" data-borra title="Borrar" class="admin-gal__borrar">✕</button>
        </div>
      </div>`).join("");

    cont.querySelectorAll(".admin-gal__item").forEach(el => {
      const id = el.dataset.id;
      el.querySelector("[data-sube]").addEventListener("click", () => galMover(id, -1));
      el.querySelector("[data-baja]").addEventListener("click", () => galMover(id, 1));
      el.querySelector("[data-borra]").addEventListener("click", () => galBorrar(id));
      // El texto alternativo se guarda al salir del campo.
      el.querySelector("[data-alt]").addEventListener("blur", (e) => galGuardarAlt(id, e.target.value));
    });
  };

  /* Reordenar: se reescribe el "orden" de todas para que quede 0,1,2… */
  const galMover = async (id, dir) => {
    const i = galImagenes.findIndex(x => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= galImagenes.length) return;
    [galImagenes[i], galImagenes[j]] = [galImagenes[j], galImagenes[i]];
    galPintar();
    galEstado("Guardando orden…");
    for (let k = 0; k < galImagenes.length; k++) {
      await sb.from("producto_imagenes").update({ orden: k }).eq("id", galImagenes[k].id);
      galImagenes[k].orden = k;
    }
    galEstado("Orden guardado.");
  };

  const galGuardarAlt = async (id, alt) => {
    const im = galImagenes.find(x => x.id === id);
    if (!im || (im.alt || "") === alt.trim()) return;
    const { error } = await sb.from("producto_imagenes")
      .update({ alt: alt.trim() || null }).eq("id", id);
    if (error) { galEstado("No se pudo guardar el texto."); return; }
    im.alt = alt.trim();
    galEstado("Texto guardado.");
  };

  const galBorrar = async (id) => {
    const ok = await Confirm.show("Borrar imagen",
      "Se quita de la galería del producto. El archivo queda en la nube pero deja de mostrarse.",
      "Sí, borrar");
    if (!ok) return;
    const { error } = await sb.from("producto_imagenes").delete().eq("id", id);
    if (error) { galEstado("No se pudo borrar: " + error.message); return; }
    galImagenes = galImagenes.filter(x => x.id !== id);
    galPintar();
    galEstado("Imagen borrada.");
  };

  const galSubir = async (files) => {
    if (!galProductoId || !files || !files.length) return;
    const lista = Array.from(files);
    let n = 0;

    for (const file of lista) {
      galEstado(`Subiendo ${++n} de ${lista.length}…`);
      try {
        const url = await subirFoto(file);
        const orden = galImagenes.length ? Math.max(...galImagenes.map(x => x.orden || 0)) + 1 : 0;
        const { data, error } = await sb.from("producto_imagenes")
          .insert({ producto_id: galProductoId, url, orden }).select().single();
        if (error) throw new Error(error.message);
        galImagenes.push(data);
        galPintar();
      } catch (e) {
        galEstado("Falló una imagen: " + e.message);
        return;
      }
    }
    galEstado(lista.length === 1 ? "Imagen agregada." : lista.length + " imágenes agregadas.");
    document.getElementById("gal-file").value = "";
  };

  const initGaleria = () => {
    document.getElementById("gal-file")?.addEventListener("change", (e) => galSubir(e.target.files));
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
    initGaleria();
    initFormCat();
    initFormMarca();
    initControlesTabla();
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
