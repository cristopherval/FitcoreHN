/* =========================================================================
   store.js  —  Capa de persistencia (localStorage)
   -------------------------------------------------------------------------
   Único módulo que habla con localStorage. El resto del sitio llama a estas
   funciones, de modo que migrar a una base de datos real más adelante solo
   implica reescribir este archivo (misma firma de funciones).
   ========================================================================= */

const Store = (() => {
  /* --- Utilidades internas --- */
  const leer = (clave, porDefecto) => {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : porDefecto;
    } catch (e) {
      console.warn("Error leyendo", clave, e);
      return porDefecto;
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
    const versionGuardada = Number(localStorage.getItem(STORAGE_KEYS.version) || 0);
    const necesitaSemilla = versionGuardada !== DATA_VERSION
      || !localStorage.getItem(STORAGE_KEYS.categorias)
      || !localStorage.getItem(STORAGE_KEYS.productos);

    if (necesitaSemilla) {
      escribir(STORAGE_KEYS.categorias, DEFAULT_CATEGORIAS);
      escribir(STORAGE_KEYS.productos, DEFAULT_PRODUCTOS);
      escribir(STORAGE_KEYS.version, DATA_VERSION);
    }
    if (!localStorage.getItem(STORAGE_KEYS.adminPass)) {
      escribir(STORAGE_KEYS.adminPass, "admin1234"); // contraseña inicial (cámbiala en el panel)
    }
  };

  /* --- Categorías --- */
  const getCategorias = () => leer(STORAGE_KEYS.categorias, DEFAULT_CATEGORIAS);
  const setCategorias = (cats) => escribir(STORAGE_KEYS.categorias, cats);

  /* --- Productos --- */
  const getProductos = () => leer(STORAGE_KEYS.productos, DEFAULT_PRODUCTOS);
  const setProductos = (prods) => escribir(STORAGE_KEYS.productos, prods);
  const getProducto = (id) => getProductos().find(p => p.id === id);

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
    getCarrito, setCarrito,
    getPass, setPass,
    nuevoId
  };
})();

/* Arranca las semillas inmediatamente al cargar el script. */
Store.init();
