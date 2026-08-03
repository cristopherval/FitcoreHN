/* =========================================================================
   pet3d.js  —  Tigre 3D estilo bloques con VISTA AÉREA que camina siguiendo
                el cursor · SOLO PC
   -------------------------------------------------------------------------
   · Construido por código con cajas (Three.js), sin modelos externos.
   · Vista aérea 3/4: el tigre camina sobre el piso y gira en 360° hacia donde
     va, a VELOCIDAD CONSTANTE (no se teletransporta). Las 4 patas se animan.
   · Solo escritorio con mouse. Se usa en nosotros.html y contacto.html.
   ========================================================================= */

(() => {
  "use strict";

  const V = "?v=59";
  const SPEED_PX_S = 340;   // velocidad constante (px/seg en pantalla)
  const PPU = 4.2;          // pixeles por unidad de mundo (controla el tamaño)
  const ELEV = 1.02;        // elevación de la cámara (rad) ~58°: vista aérea 3/4
  const LARGO_U = 34;       // largo del tigre en unidades de mundo

  const COL = {
    naranja: 0xE0872A, naranjaOsc: 0xC2701c, raya: 0x2b2018,
    crema: 0xF3E4C4, negro: 0x161310
  };

  const esEscritorio = () => {
    try {
      const tieneMouse = window.matchMedia("(any-pointer: fine)").matches;
      const anchoOk = window.innerWidth >= 800;
      const ok = tieneMouse && anchoOk;
      if (!ok) console.info("pet3d desactivado → any-pointer:fine=%s ancho>=800=%s", tieneMouse, anchoOk);
      return ok;
    } catch (e) { return false; }
  };

  const cargarScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  /* --- Construye el tigre con cajas. Parado, mirando hacia +X. --- */
  const construirTigre = () => {
    const box = (w, h, d, color) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    const t = new THREE.Group();

    const bodyLen = 16, bodyH = 7, bodyD = 7;
    t.add(box(bodyLen, bodyH, bodyD, COL.naranja));
    const belly = box(bodyLen * 0.9, 2, bodyD * 0.7, COL.crema);
    belly.position.y = -bodyH / 2 + 0.9; t.add(belly);
    [-5.5, -2, 1.5, 5].forEach((x) => {
      const s = box(1.4, bodyH + 0.5, bodyD + 0.5, COL.raya); s.position.x = x; t.add(s);
    });

    const headS = 8;
    const headX = bodyLen / 2 + headS / 2 - 1.5;
    const head = box(headS, headS, headS, COL.naranja); head.position.set(headX, 1.5, 0); t.add(head);
    const rc = box(1.3, headS + 0.4, headS + 0.4, COL.raya); rc.position.set(headX - 1.6, 1.5, 0); t.add(rc);
    const muzzle = box(4, 3.6, 5.2, COL.crema); muzzle.position.set(headX + headS / 2, -0.2, 0); t.add(muzzle);
    const nose = box(1.8, 1.4, 2.2, COL.negro); nose.position.set(headX + headS / 2 + 1.9, 0.6, 0); t.add(nose);
    // Ojos (blanco + pupila) — parpadean y miran; cejas para expresión
    const eyes = [], pupils = [], ears = [];
    [-2.3, 2.3].forEach((z) => {
      const eye = new THREE.Group();
      eye.position.set(headX + headS / 2 - 0.3, 2.5, z);
      eye.add(box(1.8, 2.2, 1.6, 0xF4F1E6));                        // blanco del ojo
      const pupil = box(1.0, 1.3, 1.1, COL.negro); pupil.position.x = 0.6; eye.add(pupil);
      t.add(eye); eyes.push(eye); pupils.push(pupil);
      const brow = box(2.1, 0.6, 1.8, COL.raya);                    // ceja
      brow.position.set(headX + headS / 2 - 0.2, 4.0, z); brow.rotation.z = (z < 0 ? 0.17 : -0.17);
      t.add(brow);
    });
    // Bigotes
    [-1, 1].forEach((s) => [-0.5, 0.5].forEach((yy) => {
      const w = box(4.4, 0.22, 0.22, 0xFDFBF3);
      w.position.set(headX + headS / 2 + 2.3, -0.4 + yy, s * 2.3); w.rotation.y = s * 0.22; t.add(w);
    }));
    // Orejas en grupo (pivote en la base → se mueven)
    [-2.4, 2.4].forEach((z) => {
      const ear = new THREE.Group(); ear.position.set(headX - 1, 4.2, z);
      const shell = box(2.2, 2.6, 1.5, COL.naranja); shell.position.y = 1.3; ear.add(shell);
      const inner = box(1.1, 1.4, 0.7, COL.raya); inner.position.set(0.05, 1.4, 0); ear.add(inner);
      t.add(ear); ears.push(ear);
    });

    const tail = new THREE.Group();
    tail.position.set(-bodyLen / 2, bodyH / 2 - 1.5, 0);
    const t1 = box(6, 1.7, 1.7, COL.naranja); t1.position.x = -3; tail.add(t1);
    const t2 = box(2.2, 1.9, 1.9, COL.raya); t2.position.x = -6.5; tail.add(t2);
    tail.rotation.z = 0.7; t.add(tail);

    const legW = 3, legH = 8, legD = 3, hipY = -bodyH / 2 + 0.5;
    const pata = (x, z) => {
      const g = new THREE.Group(); g.position.set(x, hipY, z);
      const m = box(legW, legH, legD, COL.naranjaOsc); m.position.y = -legH / 2; g.add(m);
      const paw = box(legW + 0.4, 1.8, legD + 0.4, COL.raya); paw.position.y = -legH + 0.9; g.add(paw);
      t.add(g); return g;
    };
    const fx = bodyLen / 2 - 2.5, bx = -bodyLen / 2 + 2.5, zz = bodyD / 2 - 1.2;
    const legs = { fn: pata(fx, zz), ff: pata(fx, -zz), bn: pata(bx, zz), bf: pata(bx, -zz) };
    return { tigre: t, legs, tail, cara: { eyes, pupils, ears } };
  };

  const lerpAng = (a, b, t) => a + (((b - a + Math.PI) % (2 * Math.PI)) - Math.PI) * t;

  const init = () => {
    if (typeof THREE === "undefined") { console.warn("pet3d: Three.js no disponible."); return; }

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "90" });
    document.body.appendChild(canvas);

    // Viñeta (globo de diálogo) para cuando el visitante está inactivo.
    const bubble = document.createElement("div");
    bubble.className = "pet3d-bubble";
    document.body.appendChild(bubble);
    const estilo = document.createElement("style");
    estilo.textContent =
      ".pet3d-bubble{position:fixed;left:0;top:0;transform:translate(-50%,-120%) scale(.8);transform-origin:center bottom;" +
      "background:#fff;color:#14181f;font-family:'Oswald',system-ui,sans-serif;font-weight:600;font-size:14px;letter-spacing:.3px;" +
      "padding:8px 14px;border-radius:14px;white-space:nowrap;box-shadow:0 8px 22px rgba(0,0,0,.28);border:2px solid #0e7a4c;" +
      "pointer-events:none;opacity:0;transition:opacity .28s ease,transform .28s cubic-bezier(.2,1.4,.4,1);z-index:95;}" +
      ".pet3d-bubble.show{opacity:1;transform:translate(-50%,-135%) scale(1);}" +
      ".pet3d-bubble::after{content:'';position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);width:0;height:0;" +
      "border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid #0e7a4c;}";
    document.head.appendChild(estilo);
    const FRASES = ["¡Llevá tu creatina! 💪", "Escribinos ahora 📲", "Alcanzá tu mejor versión 🔥"];

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    let W = window.innerWidth, H = window.innerHeight;

    // Cámara ortográfica (tamaño constante) mirando el piso desde ARRIBA y adelante.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
    const camDist = 1500;
    camera.position.set(0, Math.sin(ELEV) * camDist, Math.cos(ELEV) * camDist);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(0.3, 1, 0.6); scene.add(dir);

    const aplicarTamano = () => {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.left = -W / 2 / PPU; camera.right = W / 2 / PPU;
      camera.top = H / 2 / PPU; camera.bottom = -H / 2 / PPU;
      camera.updateProjectionMatrix();
    };
    aplicarTamano();
    window.addEventListener("resize", aplicarTamano, { passive: true });

    // Jerarquía: mover(posición en el piso) → facing(gira 360°) → escala → tigre
    const mover = new THREE.Group();
    const facing = new THREE.Group();
    const scaleG = new THREE.Group();
    mover.add(facing); facing.add(scaleG); scene.add(mover);

    const { tigre, legs, tail, cara } = construirTigre();
    tigre.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(tigre);
    const size = new THREE.Vector3(); bb.getSize(size);
    const ctr = new THREE.Vector3(); bb.getCenter(ctr);
    tigre.position.set(-ctr.x, -bb.min.y, -ctr.z);   // centrar en XZ, patas sobre el piso (y=0)
    scaleG.scale.setScalar(LARGO_U / (size.x || 1));
    scaleG.add(tigre);

    // Raycast del cursor al piso (y=0)
    const raycaster = new THREE.Raycaster();
    const piso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const SPEED_U = SPEED_PX_S / PPU;

    const pos = { x: 0, z: 0 };
    let mx = W / 2, my = H / 2;
    let faceAng = 0, walkPhase = 0, walkBlend = 0;
    let idleSince = performance.now(), bubbleOn = false, fraseIdx = 0, lastFrase = 0;
    let nextBlink = performance.now() + 1800, blinkStart = -9999;
    let nextTwitch = performance.now() + 2500, twitchStart = -9999, twEar = 0;
    let sitBlend = 0;
    const proj = new THREE.Vector3();
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      idleSince = performance.now();
      if (bubbleOn) { bubble.classList.remove("show"); bubbleOn = false; }
    }, { passive: true });

    let last = performance.now(), visible = true;
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; });

    const tick = (now) => {
      requestAnimationFrame(tick);
      if (!visible) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.05); last = now;

      // Cursor → punto del piso
      raycaster.setFromCamera(new THREE.Vector2((mx / W) * 2 - 1, -(my / H) * 2 + 1), camera);
      raycaster.ray.intersectPlane(piso, hit);

      const dx = hit.x - pos.x, dz = hit.z - pos.z;
      const dist = Math.hypot(dx, dz);
      let avance = 0;
      if (dist > 1) {
        avance = Math.min(SPEED_U * dt, dist);   // paso fijo, sin pasarse
        pos.x += (dx / dist) * avance;
        pos.z += (dz / dist) * avance;
        const objetivo = Math.atan2(-dz, dx);    // mirar hacia donde camina (360°)
        faceAng = lerpAng(faceAng, objetivo, Math.min(1, dt * 9));
      }
      facing.rotation.y = faceAng;

      // --- Patas: ciclo por TIEMPO mientras camina → siempre da pasos completos,
      //     aunque muevas poco el cursor. La frecuencia sube un poco con la velocidad.
      const activo = avance > 0.03;
      walkBlend += ((activo ? 1 : 0) - walkBlend) * Math.min(1, dt * 8);
      const velF = (SPEED_U * dt) > 0 ? Math.min(1, avance / (SPEED_U * dt)) : 0;
      if (walkBlend > 0.01) walkPhase += dt * (8 + 5 * velF);
      const amp = 0.62 * walkBlend;
      legs.fn.rotation.z = Math.sin(walkPhase) * amp;
      legs.bf.rotation.z = Math.sin(walkPhase) * amp;
      legs.ff.rotation.z = Math.sin(walkPhase + Math.PI) * amp;
      legs.bn.rotation.z = Math.sin(walkPhase + Math.PI) * amp;
      tail.rotation.z = 0.7 + Math.sin(now / 240) * 0.18;

      // --- Inactivo ~5s: el tigre se SIENTA (y luego aparece la viñeta) ---
      const idle = (now - idleSince > 5000 && dist < 3);
      sitBlend += ((idle ? 1 : 0) - sitBlend) * Math.min(1, dt * 6);
      scaleG.rotation.z = sitBlend * 0.5;         // inclina el frente hacia arriba
      legs.bn.rotation.z += sitBlend * 1.2;       // patas traseras se pliegan
      legs.bf.rotation.z += sitBlend * 1.2;
      legs.fn.rotation.z += sitBlend * -0.12;     // delanteras firmes
      legs.ff.rotation.z += sitBlend * -0.12;

      // --- Cara con vida: parpadeo, mirada y orejas ---
      if (now > nextBlink) { blinkStart = now; nextBlink = now + 2200 + Math.random() * 2800; }
      const bt = now - blinkStart;
      const eyeSY = bt < 150 ? (bt < 75 ? 1 - (bt / 75) * 0.88 : 0.12 + ((bt - 75) / 75) * 0.88) : 1;
      cara.eyes.forEach((e) => { e.scale.y = eyeSY; });
      const lookX = 0.55 + (activo ? 0.45 : Math.sin(now / 950) * 0.45);
      const lookY = Math.sin(now / 1400) * 0.3;
      cara.pupils.forEach((p) => { p.position.x = lookX; p.position.y = lookY; });
      if (now > nextTwitch) { twitchStart = now; nextTwitch = now + 2800 + Math.random() * 4200; twEar = Math.random() < 0.5 ? 0 : 1; }
      const twt = now - twitchStart;
      const tw = twt < 280 ? Math.sin((twt / 280) * Math.PI) * 0.5 : 0;
      cara.ears.forEach((ear, i) => { ear.rotation.z = (i === twEar ? tw : 0); });

      const bob = walkBlend > 0.05 ? Math.abs(Math.sin(walkPhase)) * 0.8 * walkBlend : Math.sin(now / 500) * 0.5;
      mover.position.set(pos.x, bob, pos.z);

      // --- Viñeta: si el visitante está inactivo ~5s y el tigre ya llegó, aparece. ---
      if (idle) {
        if (!bubbleOn) {
          bubbleOn = true; lastFrase = now;
          bubble.textContent = FRASES[fraseIdx % FRASES.length]; fraseIdx++;
          bubble.classList.add("show");
        } else if (now - lastFrase > 3500) {   // rota la frase mientras sigue inactivo
          lastFrase = now;
          bubble.textContent = FRASES[fraseIdx % FRASES.length]; fraseIdx++;
        }
        proj.set(pos.x, 24, pos.z).project(camera);  // ancla arriba de la cabeza
        bubble.style.left = ((proj.x * 0.5 + 0.5) * W) + "px";
        bubble.style.top = ((-proj.y * 0.5 + 0.5) * H) + "px";
      }

      renderer.render(scene, camera);
    };
    requestAnimationFrame(tick);
    console.info("pet3d: 🐯 tigre aéreo listo y caminando.");
  };

  const arrancar = () => {
    if (!esEscritorio()) return;
    console.info("pet3d: escritorio OK, cargando Three.js…");
    cargarScript("assets/vendor/three.min.js" + V)
      .then(init)
      .catch((e) => console.warn("pet3d: no se pudo cargar Three.js.", e));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
