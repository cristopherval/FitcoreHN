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

  const init = () => {
    if (!localStorage.getItem(STORAGE_KEYS.adminPass)) {
      escribir(STORAGE_KEYS.adminPass, "admin1234"); // contraseña inicial
    }
  };

  /* Catálogo PÚBLICO en memoria.
     Empieza con los datos de respaldo de data.js y se sobreescribe con
     data.json (la fuente real que subes a GitHub) en cuanto carga. */
  const _pub = {
    productos: clon(DEFAULT_PRODUCTOS),
    categorias: clon(DEFAULT_CATEGORIAS),
    testimonios: clon(TESTIMONIOS)
  };

  /* Carga data.json SIEMPRE fresco (sin caché) → al publicar, todos ven el
     cambio de inmediato. Si falla (file:// o sin red), usa el respaldo. */
  const cargar = async () => {
    try {
      const res = await fetch("data.json?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j.productos))   _pub.productos = j.productos;
        if (Array.isArray(j.categorias))  _pub.categorias = j.categorias;
        if (Array.isArray(j.testimonios)) _pub.testimonios = j.testimonios;
      }
    } catch (e) {
      console.info("data.json no disponible; usando catálogo de respaldo (data.js).");
    }
  };
  const ready = cargar(); // promesa: las páginas esperan esto antes de renderizar

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
  const getCategorias = () => adminActivo() ? leer(STORAGE_KEYS.categorias, _pub.categorias) : _pub.categorias;
  const setCategorias = (cats) => escribir(STORAGE_KEYS.categorias, cats);

  /* --- Productos --- */
  const getProductos = () => adminActivo() ? leer(STORAGE_KEYS.productos, _pub.productos) : _pub.productos;
  const setProductos = (prods) => escribir(STORAGE_KEYS.productos, prods);
  const getProducto = (id) => getProductos().find(p => p.id === id);

  /* --- Testimonios --- */
  const getTestimonios = () => adminActivo() ? leer(STORAGE_KEYS.testimonios, _pub.testimonios) : _pub.testimonios;
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
    init, ready,
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
