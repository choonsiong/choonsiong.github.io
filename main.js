/*
 * app.choonsiong.com — landing page scene
 * three.js r187, loaded via the import map in index.html.
 *
 * Scene: a slowly rotating wireframe icosahedron with a glassy core,
 * two orbiting rings, and a soft particle field. The camera drifts with
 * the cursor and eases backward as you scroll.
 */
import * as THREE from "three";

// ---------- Non-3D page behaviour (runs even if WebGL is unavailable) ----------
const nav = document.querySelector(".nav");
const onScrollNav = () => nav.classList.toggle("scrolled", window.scrollY > 24);
onScrollNav();
window.addEventListener("scroll", onScrollNav, { passive: true });

document.getElementById("year").textContent = new Date().getFullYear();

const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

// Cursor-following glow on cards.
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  });
});

// ---------- three.js scene ----------
const canvas = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
} catch (err) {
  document.body.classList.add("no-webgl");
  console.warn("WebGL unavailable, falling back to static background.", err);
}

if (renderer) {
  const COLORS = {
    teal: new THREE.Color("#5eead4"),
    violet: new THREE.Color("#a78bfa"),
    pink: new THREE.Color("#f472b6"),
  };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07090f, 0.035);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // --- Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const keyLight = new THREE.PointLight(COLORS.teal, 60, 30, 2);
  keyLight.position.set(4, 3, 5);
  const fillLight = new THREE.PointLight(COLORS.violet, 50, 30, 2);
  fillLight.position.set(-5, -2, 3);
  const rimLight = new THREE.PointLight(COLORS.pink, 25, 30, 2);
  rimLight.position.set(0, 4, -4);
  scene.add(keyLight, fillLight, rimLight);

  // --- Core group: sits right of centre on wide screens so it doesn't fight the headline
  const core = new THREE.Group();
  scene.add(core);

  const innerGeo = new THREE.IcosahedronGeometry(1.35, 3);
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f1522,
    metalness: 0.35,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    emissive: new THREE.Color("#1a1030"),
    emissiveIntensity: 0.9,
    flatShading: true,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  core.add(inner);

  const wireGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.95, 1));
  const wireMat = new THREE.LineBasicMaterial({
    color: COLORS.teal,
    transparent: true,
    opacity: 0.55,
  });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  core.add(wire);

  // Vertex dots on the wireframe
  const vertsGeo = new THREE.IcosahedronGeometry(1.95, 1);
  const vertsMat = new THREE.PointsMaterial({
    color: COLORS.teal,
    size: 0.07,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });
  const verts = new THREE.Points(vertsGeo, vertsMat);
  core.add(verts);

  // Orbiting rings
  const makeRing = (radius, color, opacity) => {
    const geo = new THREE.TorusGeometry(radius, 0.008, 8, 220);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Mesh(geo, mat);
  };
  const ringA = makeRing(2.9, COLORS.violet, 0.5);
  ringA.rotation.set(Math.PI / 2.6, 0.4, 0);
  const ringB = makeRing(3.4, COLORS.teal, 0.3);
  ringB.rotation.set(Math.PI / 1.8, -0.6, 0.3);
  core.add(ringA, ringB);

  // --- Particle field (custom shader for soft, twinkling sprites)
  const COUNT = 1600;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const tmp = new THREE.Vector3();

  for (let i = 0; i < COUNT; i++) {
    // Shell distribution: avoid the core, bias toward the mid-distance.
    const r = 4 + Math.pow(Math.random(), 0.6) * 14;
    tmp.setFromSphericalCoords(r, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2);
    positions.set([tmp.x, tmp.y * 0.7, tmp.z], i * 3);

    const t = Math.random();
    const c = t < 0.65 ? COLORS.teal : t < 0.92 ? COLORS.violet : COLORS.pink;
    colors.set([c.r, c.g, c.b], i * 3);

    sizes[i] = 0.6 + Math.random() * 1.8;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  particleGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  particleGeo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const particleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.25 + aPhase) * 0.25;
        p.x += cos(uTime * 0.18 + aPhase * 1.7) * 0.15;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (22.0 / -mv.z);

        vColor = aColor;
        vAlpha = 0.45 + 0.55 * sin(uTime * 0.9 + aPhase * 3.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * vAlpha * 0.9);
      }
    `,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // --- Interaction state
  const pointer = new THREE.Vector2(0, 0);
  const pointerTarget = new THREE.Vector2(0, 0);
  let scrollT = 0; // 0 at top, 1 after one viewport of scrolling

  window.addEventListener(
    "pointermove",
    (e) => {
      pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    },
    { passive: true }
  );
  window.addEventListener(
    "scroll",
    () => {
      scrollT = Math.min(window.scrollY / window.innerHeight, 1.5);
    },
    { passive: true }
  );

  // --- Layout: keep the core off the headline on wide screens
  let coreBaseX = 0;
  let coreDriftX = 0;
  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    // Visible half-width of the scene at z = 0 for the resting camera distance.
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 9 * camera.aspect;
    const wide = w > 900;
    coreBaseX = wide ? halfW * 0.62 : 0;
    coreDriftX = wide ? 1.6 : 0;
    core.position.y = wide ? 0.1 : 2.6;
    const s = wide ? Math.min(1, halfW / 6.4) : Math.max(0.55, Math.min(1, w / 900));
    core.scale.setScalar(s);
  };
  layout();
  window.addEventListener("resize", layout);

  // --- Render loop
  const timer = new THREE.Timer();
  timer.connect(document); // pauses the clock while the tab is hidden
  let running = true;

  const render = () => {
    timer.update();
    const t = timer.getElapsed();

    pointer.lerp(pointerTarget, 0.05);

    core.position.x += (coreBaseX + scrollT * coreDriftX - core.position.x) * 0.05;
    core.rotation.y = t * 0.12 + pointer.x * 0.25;
    core.rotation.x = Math.sin(t * 0.15) * 0.15 - pointer.y * 0.2 + scrollT * 0.8;
    inner.rotation.y = -t * 0.2;
    inner.rotation.z = t * 0.08;
    wire.rotation.y = t * 0.05;
    ringA.rotation.z = t * 0.18;
    ringB.rotation.z = -t * 0.12;

    const breathe = 1 + Math.sin(t * 0.8) * 0.02;
    inner.scale.setScalar(breathe);

    particles.rotation.y = t * 0.015 + pointer.x * 0.04;
    particles.rotation.x = pointer.y * 0.03;
    particleMat.uniforms.uTime.value = t;

    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.4 - scrollT * 5.0 - camera.position.y) * 0.04;
    camera.position.z += (9 + scrollT * 4 - camera.position.z) * 0.04;
    camera.lookAt(core.position.x * 0.4, -scrollT * 2.4, 0);

    keyLight.position.x = 4 + Math.sin(t * 0.5) * 1.5;
    fillLight.position.y = -2 + Math.cos(t * 0.4) * 1.5;

    renderer.render(scene, camera);
  };

  const loop = () => {
    if (!running) return;
    render();
    requestAnimationFrame(loop);
  };

  if (reduceMotion) {
    // One static frame; keep it correct on resize.
    render();
    window.addEventListener("resize", render);
  } else {
    loop();
    document.addEventListener("visibilitychange", () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        loop();
      } else if (!visible) {
        running = false;
      }
    });
  }
}
