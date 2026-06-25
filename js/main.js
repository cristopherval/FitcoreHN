/* =========================================================================
   main.js  —  Comportamiento global de navegación e interacción
   -------------------------------------------------------------------------
   - Navbar superior fija (sticky) con sombra al hacer scroll.
   - Barra inferior móvil con estado activo según la sección visible.
   - Acceso oculto al panel de administración (toque múltiple en el logo).
   - Scroll suave para anclas internas.
   - Año dinámico en el footer.
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  Cart.initEventos();   // prepara el drawer del carrito y los contadores
  initNavbar();
  initBottomNav();
  initSmoothScroll();
  initAdminOculto();
  initAnioFooter();
  initFeatureSpot();
  initFAQ();

  // Espera el catálogo (data.json) antes de pintar, así siempre se muestra
  // lo más reciente publicado. Las animaciones de entrada las maneja el
  // sistema propio "reveal" (IntersectionObserver + CSS).
  const pintar = () => {
    if (typeof UI !== "undefined") {
      if (document.getElementById("productos-grid")) UI.initHome();
      else UI.initCommon();
    }
    if (typeof Cart !== "undefined") Cart.render();
  };

  if (typeof Store !== "undefined" && Store.ready && Store.ready.then) {
    Store.ready.then(pintar);
  } else {
    pintar();
  }
});

/* Preguntas frecuentes: despliegue/colapso suave (anima la altura).
   Mantiene el <details> nativo (accesible) pero con transición bonita.
   Además cierra las demás al abrir una (estilo acordeón). */
function initFAQ() {
  const items = Array.from(document.querySelectorAll(".faq__item"));
  if (!items.length) return;

  const cerrar = (item) => {
    const cont = item.querySelector(".faq__a");
    if (!item.open) return;
    cont.style.height = cont.scrollHeight + "px";
    requestAnimationFrame(() => { cont.style.height = "0px"; });
    cont.addEventListener("transitionend", function te() {
      item.open = false;
      cont.style.height = "";
      cont.removeEventListener("transitionend", te);
    }, { once: true });
  };

  const abrir = (item) => {
    const cont = item.querySelector(".faq__a");
    item.open = true;                       // hace visible el contenido
    const h = cont.scrollHeight;
    cont.style.height = "0px";
    requestAnimationFrame(() => { cont.style.height = h + "px"; });
    cont.addEventListener("transitionend", function te() {
      cont.style.height = "auto";           // permite contenido flexible luego
      cont.removeEventListener("transitionend", te);
    }, { once: true });
  };

  items.forEach(item => {
    const summary = item.querySelector(".faq__q");
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.open) {
        cerrar(item);
      } else {
        items.filter(o => o !== item && o.open).forEach(cerrar); // acordeón
        abrir(item);
      }
    });
  });
}

/* Lista de beneficios de la sección Creatine: resalta uno a la vez.
   En escritorio reacciona al pasar el mouse; en móvil, al tocar. */
function initFeatureSpot() {
  const list = document.getElementById("feature-list");
  if (!list) return;
  const items = Array.from(list.querySelectorAll("[data-feature]"));
  const activar = (el) => items.forEach(i => i.classList.toggle("is-active", i === el));
  items.forEach(el => {
    el.addEventListener("click", () => activar(el));
    el.addEventListener("mouseenter", () => activar(el));
  });
}

/* Sombra/compactado del navbar superior al desplazarse. */
function initNavbar() {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menú hamburguesa (solo visible en tablets intermedias si aplica).
  const toggle = document.querySelector(".navbar__toggle");
  const links = document.querySelector(".navbar__links");
  toggle?.addEventListener("click", () => {
    const abierto = nav.classList.toggle("is-menu-open");
    toggle.setAttribute("aria-expanded", String(abierto));
  });
  links?.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => nav.classList.remove("is-menu-open"))
  );
}

/* Resalta el ítem de la barra inferior según la sección en pantalla. */
function initBottomNav() {
  const items = document.querySelectorAll(".bottomnav__item[data-section]");
  if (!items.length) return;
  const secciones = [...items].map(i => document.getElementById(i.dataset.section)).filter(Boolean);
  if (!("IntersectionObserver" in window) || !secciones.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        items.forEach(i => i.classList.toggle("is-active", i.dataset.section === entry.target.id));
      }
    });
  }, { threshold: 0.5 });
  secciones.forEach(s => obs.observe(s));
}

/* Scroll suave para enlaces que apuntan a un #ancla de la misma página. */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ACCESO OCULTO AL ADMIN:
   - Tocar 5 veces el logo en menos de ~2s lleva a admin.html.
   - También funciona la ruta directa admin.html.
   - O la combinación de teclado Ctrl + Alt + A. */
function initAdminOculto() {
  const logo = document.querySelector("[data-logo]");
  let toques = 0;
  let timer;
  logo?.addEventListener("click", (e) => {
    toques += 1;
    clearTimeout(timer);
    timer = setTimeout(() => (toques = 0), 1500);
    if (toques >= 5) {
      toques = 0;
      window.location.href = "admin.html";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "a" || e.key === "A")) {
      window.location.href = "admin.html";
    }
  });
}

/* Año actual en el footer (sin romper el caché del workflow). */
function initAnioFooter() {
  const el = document.getElementById("anio");
  if (el) el.textContent = new Date().getFullYear();
}
