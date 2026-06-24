/* =========================================================================
   confirm.js  —  Modal de confirmación reutilizable (storefront)
   -------------------------------------------------------------------------
   Crea el modal en el DOM bajo demanda y devuelve una promesa true/false.
   Se usa, por ejemplo, antes de eliminar productos del carrito.
   ========================================================================= */

const Confirm = (() => {
  let el;

  const construir = () => {
    el = document.createElement("div");
    el.className = "modal modal--confirm";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <div class="modal__box">
        <h3 class="modal__title" data-ct>Confirmar</h3>
        <p class="modal__message" data-cm></p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-cc>Cancelar</button>
          <button class="btn btn--danger" data-co>Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  };

  const show = (titulo, mensaje, okText = "Eliminar") => new Promise((resolve) => {
    if (!el) construir();
    el.querySelector("[data-ct]").textContent = titulo;
    el.querySelector("[data-cm]").textContent = mensaje;
    const ok = el.querySelector("[data-co]");
    const cancel = el.querySelector("[data-cc]");
    ok.textContent = okText;
    el.classList.add("is-open");

    const cerrar = (valor) => {
      el.classList.remove("is-open");
      ok.onclick = null; cancel.onclick = null; el.onclick = null; onKey.cancel();
      resolve(valor);
    };
    ok.onclick = () => cerrar(true);
    cancel.onclick = () => cerrar(false);
    el.onclick = (e) => { if (e.target === el) cerrar(false); };

    const onKey = (() => {
      const h = (e) => { if (e.key === "Escape") cerrar(false); };
      document.addEventListener("keydown", h);
      return { cancel: () => document.removeEventListener("keydown", h) };
    })();
  });

  return { show };
})();
