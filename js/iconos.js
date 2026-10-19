/* =========================================================================
   iconos.js  —  Biblioteca de iconos para las categorías
   -------------------------------------------------------------------------
   Dibujos propios en SVG, no una fuente de iconos externa: se ven nítidos en
   cualquier pantalla, no suman una descarga más y no dependen de un servicio
   que pueda caerse o cambiar.

   En la base solo se guarda la CLAVE (ej. 'rayo'). Para agregar un icono
   nuevo basta con añadirlo acá: aparece solo en el selector del panel.

   Todos comparten el mismo lienzo de 24x24 y trazo, así se ven parejos.
   ========================================================================= */

const ICONOS = {
  bote: {
    nombre: "Bote / Tarro",
    svg: '<path d="M8 8h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><path d="M10 13h4"/><path d="M12 11v4"/>'
  },
  shaker: {
    nombre: "Shaker / Batido",
    svg: '<path d="M8 9h8l-.8 11a2 2 0 0 1-2 1.8h-2.4a2 2 0 0 1-2-1.8z"/><path d="M7.5 6h9a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><path d="M9 2.5h6"/><path d="M8.6 14h6.8"/>'
  },
  capsula: {
    nombre: "Cápsula / Vitamina",
    // Cápsula inclinada: un rectángulo redondeado girado 45°, con la
    // línea de unión perpendicular al eje largo.
    svg: '<rect x="2" y="8.5" width="20" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>'
  },
  rayo: {
    nombre: "Rayo / Energía",
    svg: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>'
  },
  pesa: {
    nombre: "Pesa / Fuerza",
    svg: '<path d="M6.5 7v10"/><path d="M17.5 7v10"/><path d="M3.5 9.5v5"/><path d="M20.5 9.5v5"/><path d="M6.5 12h11"/>'
  },
  hoja: {
    nombre: "Hoja / Natural",
    svg: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'
  },
  corazon: {
    nombre: "Corazón / Salud",
    svg: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>'
  },
  belleza: {
    nombre: "Belleza / Bienestar",
    svg: '<path d="M12 2c3 3.5 4.5 6.8 4.5 10a4.5 4.5 0 0 1-9 0C7.5 8.8 9 5.5 12 2z"/><path d="M12 16.5V22"/><path d="M9 19.5h6"/>'
  },
  barra: {
    nombre: "Barra / Snack",
    svg: '<path d="M3.5 8.5h17a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"/><path d="M7 8.5v7"/><path d="M11 8.5v7"/><path d="M15 8.5v7"/>'
  },
  balanza: {
    nombre: "Balanza / Control de peso",
    svg: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 7v3"/><path d="M8.5 8.2l1.4 2"/><path d="M15.5 8.2l-1.4 2"/><path d="M8 17h8"/>'
  },
  gota: {
    nombre: "Gota / Hidratación",
    svg: '<path d="M12 2.5s6.5 7 6.5 11.2A6.5 6.5 0 0 1 5.5 13.7C5.5 9.5 12 2.5 12 2.5z"/>'
  },
  escudo: {
    nombre: "Escudo / Defensas",
    svg: '<path d="M12 2.5l8 3.2v6c0 5-3.4 9.2-8 10.3-4.6-1.1-8-5.3-8-10.3v-6z"/><path d="M9 12l2 2 4-4"/>'
  },
  reloj: {
    nombre: "Reloj / Recuperación",
    svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'
  },
  estrella: {
    nombre: "Estrella / Destacado",
    svg: '<path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z"/>'
  },
  combo: {
    nombre: "Combo / Paquete",
    svg: '<path d="M3 8.5l9-4.5 9 4.5v7l-9 4.5-9-4.5z"/><path d="M3 8.5l9 4.5 9-4.5"/><path d="M12 13v7"/>'
  },
  taza: {
    nombre: "Taza / Bebida",
    svg: '<path d="M4 7h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M6 3.5v1.5"/><path d="M10 3.5v1.5"/><path d="M14 3.5v1.5"/>'
  }
};

/* Devuelve el SVG listo para insertar. Si la clave no existe (por ejemplo
   una categoría vieja sin icono), cae en 'bote' para no dejar un hueco. */
function iconoSVG(clave, tam = 32) {
  const ic = ICONOS[clave] || ICONOS.bote;
  return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${ic.svg}</svg>`;
}
