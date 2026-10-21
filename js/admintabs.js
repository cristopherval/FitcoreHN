/* =========================================================================
   admintabs.js  —  Menú de secciones del panel
   -------------------------------------------------------------------------
   El panel mostraba las cinco secciones una debajo de otra: para llegar a
   Envíos había que pasar por todos los productos. Ahora cada una es una
   pestaña y sólo se ve la elegida. Pedidos abre de primeras porque es lo
   que se revisa a diario.

   La pestaña activa se guarda en el hash de la URL (admin.html#productos),
   así recargar la página —o volver después de guardar algo— no te devuelve
   al principio.
   ========================================================================= */

const AdminTabs = (() => {
  const VALIDAS = ["pedidos", "productos", "categorias", "marcas", "envios", "finanzas"];
  const INICIAL = "pedidos";

  const paneles = () => document.querySelectorAll("[data-panel]");
  const botones = () => document.querySelectorAll(".admin-tab");

  /* Avisa al resto del panel que cambió la sección visible. Las tablas que
     dependen del ancho (o que aún no se habían pintado) pueden reaccionar. */
  const avisar = (nombre) => {
    document.dispatchEvent(new CustomEvent("admin:tab", { detail: { tab: nombre } }));
  };

  const mostrar = (nombre, guardarHash = true) => {
    if (!VALIDAS.includes(nombre)) nombre = INICIAL;

    paneles().forEach(p => { p.hidden = p.dataset.panel !== nombre; });

    botones().forEach(b => {
      const activa = b.dataset.tab === nombre;
      b.classList.toggle("is-active", activa);
      if (activa) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    // Al cambiar de sección se vuelve arriba: si venías del final de una
    // tabla larga, la nueva sección aparecería ya desplazada.
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

    if (guardarHash) {
      // replaceState y no el hash directo: así no se llena el historial de
      // pasos y el botón "atrás" sigue saliendo de la página.
      history.replaceState(null, "", `#${nombre}`);
    }
    avisar(nombre);
  };

  const init = () => {
    const nav = document.getElementById("admin-tabs");
    if (!nav) return;

    nav.addEventListener("click", (e) => {
      const b = e.target.closest(".admin-tab");
      if (!b) return;
      mostrar(b.dataset.tab);
    });

    // Flechas izquierda/derecha para moverse entre pestañas con el teclado.
    nav.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const lista = [...botones()];
      const i = lista.findIndex(b => b.classList.contains("is-active"));
      if (i < 0) return;
      const salto = e.key === "ArrowRight" ? 1 : -1;
      const sig = lista[(i + salto + lista.length) % lista.length];
      mostrar(sig.dataset.tab);
      sig.focus();
      e.preventDefault();
    });

    mostrar((location.hash || "").replace("#", "") || INICIAL, false);
  };

  /* Contador de pedidos por revisar, espejo del que ya vive en la sección.
     Puesto en la pestaña se ve aunque estés en Productos. */
  const setPendientes = (n) => {
    const el = document.getElementById("tab-ped-n");
    if (!el) return;
    el.textContent = n;
    el.hidden = !n;
  };

  /* Repite el aviso de la sección visible (tras iniciar sesión, por ejemplo). */
  const reavisar = () => {
    const activa = [...botones()].find(b => b.classList.contains("is-active"));
    avisar(activa ? activa.dataset.tab : INICIAL);
  };

  return { init, mostrar, setPendientes, reavisar };
})();

document.addEventListener("DOMContentLoaded", AdminTabs.init);
