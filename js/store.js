/* =========================================================================
   store.js  —  Fuente de datos (Supabase) + carrito (localStorage)
   -------------------------------------------------------------------------
   · Productos y categorías se leen de Supabase (visibles para todos al
     instante, sin publicar ni hacer push).
   · Si Supabase no responde (sin internet, etc.) se usan los datos de
     respaldo definidos en data.js, para que el sitio nunca se vea vacío.
   · El carrito sigue en localStorage (es de cada visitante).
   ========================================================================= */

const Store = (() => {
  /* --- Utilidades --- */
  const clon = (x) => (x && typeof x === "object") ? JSON.parse(JSON.stringify(x)) : x;

  const leer = (clave, porDefecto) => {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : clon(porDefecto);
    } catch (e) { return clon(porDefecto); }
  };

  const escribir = (clave, valor) => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) { console.error("No se pudo guardar en el navegador", e); return false; }
  };

  /* Catálogo en memoria. Arranca con el respaldo de data.js y se
     reemplaza con lo que venga de Supabase. */
  const _pub = {
    productos:   clon(typeof DEFAULT_PRODUCTOS  !== "undefined" ? DEFAULT_PRODUCTOS  : []),
    categorias:  clon(typeof DEFAULT_CATEGORIAS !== "undefined" ? DEFAULT_CATEGORIAS : []),
    testimonios: clon(typeof TESTIMONIOS        !== "undefined" ? TESTIMONIOS        : []),
    marcas:      []
  };

  /* Traduce una fila de Supabase (snake_case) al formato que usa el sitio. */
  const mapProducto = (r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion || "",
    precio: Number(r.precio),
    precioAnterior: (r.precio_anterior == null) ? null : Number(r.precio_anterior),
    categoria: r.categoria_id,
    marca: r.marca_id || "",
    imagen: r.imagen_url || "assets/atleta-espalda.png",
    destacado: !!r.destacado,
    enOfertas: !!r.en_ofertas
  });

  const mapCategoria = (c) => ({
    id: c.id, nombre: c.nombre, descripcion: c.descripcion || "",
    imagen: c.imagen_url || ""
  });

  const mapMarca = (m) => ({ id: m.id, nombre: m.nombre });

  /* Carga el catálogo desde Supabase. */
  const cargar = async () => {
    if (typeof sb === "undefined" || !sb) {
      console.warn("Supabase no disponible: usando catálogo de respaldo (data.js).");
      return;
    }
    try {
      const [cats, prods, mrcs] = await Promise.all([
        sb.from("categorias").select("*").order("orden", { ascending: true }),
        sb.from("productos").select("*").order("orden", { ascending: true }),
        sb.from("marcas").select("*").order("orden", { ascending: true })
      ]);

      if (cats.error) console.error("Error leyendo categorías:", cats.error.message);
      else if (Array.isArray(cats.data) && cats.data.length) _pub.categorias = cats.data.map(mapCategoria);

      if (prods.error) console.error("Error leyendo productos:", prods.error.message);
      else if (Array.isArray(prods.data)) _pub.productos = prods.data.map(mapProducto);

      // La tabla "marcas" es opcional: si aún no existe, se ignora sin romper nada.
      if (mrcs.error) console.warn("Marcas no disponibles (¿falta la tabla?):", mrcs.error.message);
      else if (Array.isArray(mrcs.data)) _pub.marcas = mrcs.data.map(mapMarca);

    } catch (e) {
      console.error("Fallo al conectar con Supabase; usando respaldo.", e);
    }
  };

  /* Promesa que las páginas esperan antes de pintar. */
  const ready = cargar();

  /* Vuelve a leer de Supabase (útil tras guardar en el panel admin). */
  const recargar = () => cargar();

  /* --- Lectura del catálogo --- */
  const getCategorias  = () => _pub.categorias;
  const getProductos   = () => _pub.productos;
  const getProducto    = (id) => _pub.productos.find(p => String(p.id) === String(id));
  const getTestimonios = () => _pub.testimonios;
  const getMarcas      = () => _pub.marcas;
  const getMarca       = (id) => _pub.marcas.find(m => String(m.id) === String(id));

  /* --- Carrito (localStorage) --- */
  const getCarrito = () => leer(STORAGE_KEYS.carrito, []);
  const setCarrito = (items) => escribir(STORAGE_KEYS.carrito, items);

  return {
    ready, recargar,
    getCategorias, getProductos, getProducto, getTestimonios,
    getMarcas, getMarca,
    getCarrito, setCarrito
  };
})();
