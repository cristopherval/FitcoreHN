/* =========================================================================
   pet3d.js  —  Mascota 3D (tigre) que sigue el cursor · SOLO PC
   -------------------------------------------------------------------------
   · Se activa solo en escritorio (puntero fino, pantalla ancha, sin touch,
     y respetando "prefiero menos movimiento"). En móvil ni siquiera descarga
     Three.js.
   · Sigue el cursor a VELOCIDAD CONSTANTE y gira para mirar hacia donde va.
   · Se usa solo en nosotros.html y contacto.html.

   Modelo 3D: "Tiger" por Poly by Google — Licencia Creative Commons Attribution
   (CC BY). Fuente: poly.pizza.
   ========================================================================= */

(() => {
  "use strict";

  const V = "?v=52";
  const SPEED_PX_S = 260;   // velocidad constante de persecución (px/seg)
  const TARGET_H   = 120;   // alto del tigre en pantalla (px)
  const FOLLOW_OFFSET = 26; // se ubica un poco abajo-derecha del cursor

  /* --- ¿Es una PC apta? (tiene mouse que puede hacer hover, pantalla ancha,
     y no pidió menos movimiento). NO se descarta por tener touch: una laptop
     híbrida con mouse SÍ es PC. --- */
  const esEscritorio = () => {
    try {
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      const canHover = window.matchMedia("(hover: hover)").matches;
      const anchoOk = window.innerWidth >= 1024;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ok = finePointer && canHover && anchoOk && !reduce;
      if (!ok) console.info("pet3d desactivado → pointer:fine=%s hover:hover=%s ancho>=1024=%s reduce=%s",
        finePointer, canHover, anchoOk, reduce);
      return ok;
    } catch (e) { return false; }
  };

  const cargarScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  /* --- Inicializa la escena una vez cargado Three.js + GLTFLoader --- */
  const init = () => {
    if (typeof THREE === "undefined" || !THREE.GLTFLoader) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", width: "100%", height: "100%",
      pointerEvents: "none", zIndex: "90"
    });
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();

    // Cámara ortográfica mapeada a PÍXELES de pantalla (Y hacia abajo como el DOM).
    let W = window.innerWidth, H = window.innerHeight;
    const camera = new THREE.OrthographicCamera(0, W, 0, H, -1000, 1000);
    camera.position.z = 100;

    // Luces para que el low-poly se lea como 3D.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(0.4, -1, 0.8);
    scene.add(dir);

    const aplicarTamano = () => {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = H;
      camera.updateProjectionMatrix();
    };
    aplicarTamano();
    window.addEventListener("resize", aplicarTamano, { passive: true });

    // grupo (posición en pantalla) → pivot (rotaciones/centrado del modelo)
    const grupo = new THREE.Group();
    const pivot = new THREE.Group();
    grupo.add(pivot);
    scene.add(grupo);

    // Estado de movimiento
    const pos = { x: W / 2, y: H / 2 };      // posición actual del tigre
    const mouse = { x: W / 2, y: H / 2 };    // objetivo (cursor)
    let hayModelo = false;
    let faceYaw = 0, targetYaw = 0;

    // Orientación base del modelo: perfil mirando a la derecha + leve 3/4 desde arriba.
    // (Si el tigre apareciera mirando de frente, se ajusta BASE_YAW en un paso.)
    const BASE_YAW = -Math.PI / 2;
    pivot.rotation.x = -0.22;

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
    }, { passive: true });

    // Cargar el modelo del tigre desde el base64 embebido (sin fetch → funciona en file://).
    const b64 = window.__TIGER_GLB_B64__;
    if (!b64) { console.warn("pet3d: el modelo embebido no se cargó."); return; }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    new THREE.GLTFLoader().parse(bytes.buffer, "", (gltf) => {
      const modelo = gltf.scene;
      console.info("pet3d: 🐯 tigre cargado y listo.");
      // Centrar y escalar a TARGET_H píxeles de alto.
      const box = new THREE.Box3().setFromObject(modelo);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      modelo.position.sub(center); // centra en el origen del pivot
      const escala = TARGET_H / (size.y || 1);
      pivot.scale.setScalar(escala);
      pivot.add(modelo);
      hayModelo = true;
    }, (err) => {
      console.warn("pet3d: no se pudo interpretar el modelo.", err);
    });

    // Bucle de animación: persecución a VELOCIDAD CONSTANTE.
    let last = performance.now();
    let visible = true;
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; });

    const tick = (now) => {
      requestAnimationFrame(tick);
      if (!visible) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.05); // seg (cap por si hubo pausa)
      last = now;

      const tx = mouse.x + FOLLOW_OFFSET;
      const ty = mouse.y + FOLLOW_OFFSET;
      const dx = tx - pos.x, dy = ty - pos.y;
      const dist = Math.hypot(dx, dy);
      const paso = SPEED_PX_S * dt;

      let moviendo = false;
      if (dist > 1) {
        const avance = Math.min(paso, dist);   // sin acelerar: paso fijo, sin pasarse
        pos.x += (dx / dist) * avance;
        pos.y += (dy / dist) * avance;
        moviendo = dist > 4;
        // Mirar hacia la izquierda o derecha según el movimiento horizontal.
        if (Math.abs(dx) > 0.5) targetYaw = BASE_YAW + (dx < 0 ? Math.PI : 0);
      }

      // Giro suave hacia la dirección (esto es orientación, no la velocidad de avance).
      faceYaw += (targetYaw - faceYaw) * Math.min(1, dt * 10);
      pivot.rotation.y = faceYaw;

      // Rebote suave en reposo (idle).
      const bob = moviendo ? 0 : Math.sin(now / 300) * 5;

      grupo.position.set(pos.x, pos.y + bob, 0);

      if (hayModelo) renderer.render(scene, camera);
    };
    requestAnimationFrame(tick);
  };

  /* --- Arranque: solo en PC, con carga diferida de Three.js --- */
  const arrancar = () => {
    if (!esEscritorio()) return;
    console.info("pet3d: escritorio OK, cargando Three.js…");
    cargarScript("assets/vendor/three.min.js" + V)
      .then(() => cargarScript("assets/vendor/GLTFLoader.js" + V))
      .then(() => cargarScript("assets/models/tiger.glb.b64.js" + V))
      .then(init)
      .catch((e) => console.warn("pet3d: no se pudo cargar Three.js/modelo.", e));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
