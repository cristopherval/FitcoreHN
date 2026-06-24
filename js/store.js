/* =========================================================================
   store.js  —  Capa de persistencia (localStorage)
   -------------------------------------------------------------------------
   Único módulo que habla con localStorage. El resto del sitio llama a estas
   funciones, de modo que migrar a una base de datos real más adelante solo
   implica reescribir este archivo (misma firma de funciones).
   ========================================================================= */

const Store = (() => {
  /* --- Utilidades internas --- */
  // Devuelve una COPIA del valor por defecto para no mutar nunca los datos de data.js.
  const clon = (x) => (x && typeof x === "object") ? JSON.parse(JSON.stringify(x)) : x;
  const leer = (clave, porDefecto) => {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : clon(porDefecto);
    } catch (e) {
      console.warn("Error leyendo", clave, e);
      return clon(porDefecto);
    }
  };

  const escribir = (clave, valor) => {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      // Suele ocurrir si las imágenes base64 superan la cuota del navegador.
      console.error("No se pudo guardar (¿cuota llena?)", e);
      alert("No se pudo guardar. Es posible que el almacenamiento esté lleno (imágenes muy pesadas).");
      return false;
    }
  };

  /* Inicializa/actualiza las semillas.
     Si la versión del catálogo de ejemplo cambió (DATA_VERSION), se vuelve a
     cargar el catálogo de ejemplo para reflejar los nuevos cambios. */
  const init = () => {
    // El catálogo público sale de data.js. Aquí solo aseguramos la contraseña.
    if (!localStorage.getItem(STORAGE_KEYS.adminPass)) {
      escribir(STORAGE_KEYS.adminPass, "admin1234"); // contraseña inicial (cámbiala en el panel)
    }
  };

  /* ¿Sesión de administrador activa en ESTA pestaña? */
  const adminActivo = () => {
    try { return sessionStorage.getItem("fitcore_admin_session") === "1"; }
    catch (e) { return false; }
  };

  /* IMPORTANTE — Fuente de verdad:
     El PÚBLICO siempre ve el catálogo de data.js (lo que subes a GitHub).
     En modo admin se usa una copia local (localStorage) SOLO como vista previa;
     esos cambios NO se publican hasta editar data.js y hacer push. */

  /* --- Categorías --- */
  const getCategorias = () => adminActivo() ? leer(STORAGE_KEYS.categorias, DEFAULT_CATEGORIAS) : DEFAULT_CATEGORIAS;
  const setCategorias = (cats) => escribir(STORAGE_KEYS.categorias, cats);

  /* --- Productos --- */
  const getProductos = () => adminActivo() ? leer(STORAGE_KEYS.productos, DEFAULT_PRODUCTOS) : DEFAULT_PRODUCTOS;
  const setProductos = (prods) => escribir(STORAGE_KEYS.productos, prods);
  const getProducto = (id) => getProductos().find(p => p.id === id);

  /* --- Testimonios --- */
  const getTestimonios = () => adminActivo() ? leer(STORAGE_KEYS.testimonios, TESTIMONIOS) : TESTIMONIOS;
  const setTestimonios = (t) => escribir(STORAGE_KEYS.testimonios, t);

  /* Descarta los cambios locales de admin (vuelve a lo publicado en data.js). */
  const descartarLocal = () => {
    localStorage.removeItem(STORAGE_KEYS.productos);
    localStorage.removeItem(STORAGE_KEYS.categorias);
    localStorage.removeItem(STORAGE_KEYS.testimonios);
  };

  /* --- Carrito --- */
  const getCarrito = () => leer(STORAGE_KEYS.carrito, []);
  const setCarrito = (items) => escribir(STORAGE_KEYS.carrito, items);

  /* --- Seguridad admin --- */
  const getPass = () => leer(STORAGE_KEYS.adminPass, "admin1234");
  const setPass = (p) => escribir(STORAGE_KEYS.adminPass, p);

  /* Genera un id único sin depender de Date.now()/random globales. */
  let _seq = 0;
  const nuevoId = (prefijo = "id") => {
    _seq += 1;
    const base = (typeof performance !== "undefined" ? Math.floor(performance.now()) : 0);
    return `${prefijo}_${base}_${_seq}`;
  };

  return {
    init,
    getCategorias, setCategorias,
    getProductos, setProductos, getProducto,
    getTestimonios, setTestimonios,
    descartarLocal,
    getCarrito, setCarrito,
    getPass, setPass,
    nuevoId
  };
})();

/* Arranca las semillas inmediatamente al cargar el script. */
Store.init();
