/*
 * app.choonsiong.com — landing page scene
 * three.js r187, loaded via the import map in index.html.
 *
 * Scene: a slowly rotating wireframe icosahedron with a glassy core,
 * two orbiting rings, and a soft particle field. The camera drifts with
 * the cursor and eases backward as you scroll.
 *
 * The Stack section has a second, smaller scene of its own: a ring split
 * into one segment per language, drawn on its own canvas (mountStackRing,
 * at the bottom of this file).
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

// Data files written daily by .github/workflows/data.yml to this repo's
// `data` branch. Served locally (python3 -m http.server) the page tries
// the git-ignored local copies first, so the scripts' output can be
// previewed before the workflow publishes it.
const DATA_BRANCH = "https://raw.githubusercontent.com/choonsiong/choonsiong.github.io/data";
const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

async function fetchData(name) {
  if (LOCAL) {
    const local = await fetch(`./${name}`).catch(() => null);
    if (local?.ok) return local.json();
  }
  const res = await fetch(`${DATA_BRANCH}/${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// GitHub contribution calendar, from contributions.json. Weeks run Sunday
// to Saturday, as on GitHub; the first week is padded so every column has
// seven rows.
async function loadContributions() {
  const body = document.getElementById("activity-body");
  const status = document.getElementById("activity-status");
  if (!body || !status) return;

  let data;
  try {
    data = await fetchData("contributions.json");
    if (!Array.isArray(data.days) || data.days.length === 0) throw new Error("no days");
  } catch (err) {
    console.warn("Contribution calendar unavailable:", err);
    document.querySelectorAll(".activity-total, .activity-foot").forEach((el) => (el.hidden = true));
    status.innerHTML =
      'The calendar could not be loaded. See it on <a href="https://github.com/choonsiong" target="_blank" rel="noopener">GitHub</a>.';
    return;
  }

  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
  const toDate = (iso) => new Date(`${iso}T00:00:00Z`);

  const cells = document.createElement("div");
  cells.className = "heatmap-cells";
  const months = document.createElement("div");
  months.className = "heatmap-months";

  // Pad the first week so the first day sits in its weekday row.
  for (let i = 0; i < toDate(data.days[0][0]).getUTCDay(); i++) {
    const pad = document.createElement("i");
    pad.className = "cell pad";
    cells.appendChild(pad);
  }

  const labels = []; // [column, text]
  let column = 0;
  let lastMonth = -1;
  data.days.forEach(([iso, count, level], i) => {
    const date = toDate(iso);
    const cell = document.createElement("i");
    cell.className = `cell l${level}`;
    cell.title = `${count === 0 ? "No" : count} contribution${count === 1 ? "" : "s"} on ${fmt.format(date)}`;
    cells.appendChild(cell);

    column = Math.floor((cells.childElementCount - 1) / 7);
    if (date.getUTCMonth() !== lastMonth) {
      lastMonth = date.getUTCMonth();
      const label = [column, monthFmt.format(date)];
      // Two months in one column: the later one owns most of it.
      if (labels.length && labels[labels.length - 1][0] === column) labels[labels.length - 1] = label;
      else labels.push(label);
    }
  });
  // A label in the very first column collides with the next one if a new
  // month starts a week or two later, so drop it in that case (as GitHub does).
  if (labels.length > 1 && labels[0][0] === 0 && labels[1][0] < 3) labels.shift();
  for (const [col, text] of labels) {
    const span = document.createElement("span");
    span.style.gridColumn = String(col + 1);
    span.textContent = text;
    months.appendChild(span);
  }

  const days = document.createElement("div");
  days.className = "heatmap-days";
  days.setAttribute("aria-hidden", "true");
  ["", "Mon", "", "Wed", "", "Fri", ""].forEach((d) => {
    const span = document.createElement("span");
    span.textContent = d;
    days.appendChild(span);
  });

  const first = data.days[0][0];
  const last = data.days[data.days.length - 1][0];
  const heatmap = document.createElement("div");
  heatmap.className = "heatmap";
  heatmap.setAttribute("role", "img");
  heatmap.setAttribute(
    "aria-label",
    `${data.total.toLocaleString("en")} GitHub contributions from ${fmt.format(toDate(first))} to ${fmt.format(toDate(last))}, shown as a calendar heatmap`
  );
  heatmap.append(months, days, cells);

  document.getElementById("activity-count").textContent = data.total.toLocaleString("en");
  document.getElementById("activity-updated").textContent = `Up to ${fmt.format(toDate(last))}`;
  body.replaceChildren(heatmap);
  body.scrollLeft = body.scrollWidth; // newest weeks first on narrow screens
}
loadContributions();

// Languages across the repositories, from languages.json: the largest
// eight get a colour each (--lang-1 … --lang-8, in that order), the rest
// are folded into "Other". The list is the full reading; the ring in
// mountStackRing() follows the same selection through `stack`.
const STACK_SLOTS = 8;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmtBytes = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} kB` : `${n} B`);
const fmtShare = (share) => (share * 100 < 0.1 ? "<0.1%" : `${(share * 100).toFixed(1)}%`);

const stack = {
  entries: [],
  rows: [],
  hovered: -1,
  pinned: -1,
  readout: null, // [value, name, meta] elements
  summary: null, // what the readout shows when nothing is selected
  onChange: null, // the ring subscribes here
  get active() {
    return this.hovered >= 0 ? this.hovered : this.pinned;
  },
  hover(i) {
    if (this.hovered === i) return;
    this.hovered = i;
    this.sync();
  },
  toggle(i) {
    this.pinned = this.pinned === i ? -1 : i;
    this.sync();
  },
  sync() {
    const active = this.active;
    this.rows.forEach((row, i) => {
      row.classList.toggle("is-active", i === active);
      row.setAttribute("aria-pressed", String(i === this.pinned));
    });
    if (this.readout) {
      const e = active >= 0 ? this.entries[active] : null;
      const [value, name, meta] = this.readout;
      [value.textContent, name.textContent, meta.textContent] = e ? [fmtShare(e.share), e.name, e.meta] : this.summary;
    }
    this.onChange?.(active);
  },
};

async function loadLanguages() {
  const body = document.getElementById("stack-body");
  const status = document.getElementById("stack-status");
  const list = document.getElementById("stack-list");
  if (!body || !status || !list) return null;

  let data;
  try {
    data = await fetchData("languages.json");
    if (!Array.isArray(data.languages) || data.languages.length === 0 || !(data.total > 0)) throw new Error("no languages");
  } catch (err) {
    console.warn("Language totals unavailable:", err);
    document.querySelectorAll(".stack-total, .stack-foot, .stack-scene, .stack-side").forEach((el) => (el.hidden = true));
    status.innerHTML =
      'The languages could not be loaded. See the repositories on <a href="https://github.com/choonsiong?tab=repositories" target="_blank" rel="noopener">GitHub</a>.';
    return null;
  }

  const top = data.languages.slice(0, STACK_SLOTS);
  const rest = data.languages.slice(STACK_SLOTS);
  const entries = top.map((l, i) => ({
    name: l.name,
    share: l.bytes / data.total,
    color: cssVar(`--lang-${i + 1}`),
    sub: `${l.repos} ${l.repos === 1 ? "repo" : "repos"}`,
    meta: `${fmtBytes(l.bytes)} · ${l.repos} ${l.repos === 1 ? "repo" : "repos"}`,
  }));
  if (rest.length) {
    const bytes = rest.reduce((sum, l) => sum + l.bytes, 0);
    const names = rest.slice(0, 3).map((l) => l.name).join(", ");
    entries.push({
      name: "Other",
      share: bytes / data.total,
      color: cssVar("--lang-other"),
      sub: rest.length > 3 ? `${names} and ${rest.length - 3} more` : names,
      meta: `${fmtBytes(bytes)} · ${rest.length} ${rest.length === 1 ? "language" : "languages"}`,
    });
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const items = document.createDocumentFragment();
  const strip = document.getElementById("stack-strip");
  stack.rows = entries.map((e, i) => {
    const row = el("button", "stack-row");
    row.type = "button";
    row.setAttribute("aria-pressed", "false");
    row.style.setProperty("--c", e.color);
    const bar = el("span", "stack-bar");
    const fill = el("i");
    fill.style.setProperty("--w", `${Math.max(e.share * 100, 0.6)}%`);
    bar.append(fill);
    const name = el("span", "stack-name", e.name);
    name.append(el("span", "stack-sub", e.sub));
    row.append(el("i", "stack-swatch"), name, el("span", "stack-share", fmtShare(e.share)), bar);
    row.addEventListener("pointerenter", () => stack.hover(i));
    row.addEventListener("pointerleave", () => stack.hover(-1));
    row.addEventListener("focus", () => stack.hover(i));
    row.addEventListener("blur", () => stack.hover(-1));
    row.addEventListener("click", (ev) => {
      stack.toggle(i);
      if (ev.pointerType && ev.pointerType !== "mouse") stack.hover(-1); // no hover to leave on touch
    });
    const li = el("li");
    li.append(row);
    items.append(li);

    const seg = el("i");
    seg.style.flex = `${e.share} 0 0`;
    seg.style.background = e.color;
    strip?.append(seg);
    return row;
  });
  list.replaceChildren(items);
  status.remove();

  document.getElementById("stack-count").textContent = fmtBytes(data.total);
  document.getElementById("stack-summary").textContent =
    `of source across ${data.repos.toLocaleString("en")} repositories in ${data.languages.length} languages`;
  stack.readout = ["value", "name", "meta"].map((k) => document.getElementById(`stack-readout-${k}`));
  stack.summary = [String(data.languages.length), "languages", `${data.repos.toLocaleString("en")} repositories`];
  stack.entries = entries;
  stack.sync();
  return stack;
}
const languagesReady = loadLanguages();

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

// ---------- Stack ring (its own canvas inside #stack-scene) ----------
// One extruded arc per entry, proportional to its share, lying flat under
// a tilted camera. Hovering a segment or a row lifts it; a click pins it;
// dragging spins the ring, which otherwise turns slowly on its own.
function mountStackRing(model) {
  const host = document.getElementById("stack-scene");
  const canvas = document.getElementById("stack-canvas");
  if (!host || !canvas || model.entries.length === 0) return;

  let ringRenderer;
  try {
    ringRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    console.warn("Stack ring unavailable, showing the bar instead.", err);
    document.body.classList.add("no-webgl");
    return;
  }
  ringRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ringRenderer.setClearColor(0x000000, 0);
  ringRenderer.toneMapping = THREE.NeutralToneMapping; // keeps the palette's hues truer than ACES
  ringRenderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const CAMERA_AT = new THREE.Vector3(0, 6.2, 7.4);
  camera.position.copy(CAMERA_AT);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(3, 7, 4);
  const tealLight = new THREE.PointLight(0x5eead4, 25, 30, 2);
  tealLight.position.set(-5, 3, 3);
  const violetLight = new THREE.PointLight(0xa78bfa, 25, 30, 2);
  violetLight.position.set(5, 2, -4);
  scene.add(keyLight, tealLight, violetLight);

  // The segments are built in the XY plane; `tilt` lays them flat (local z up).
  const tilt = new THREE.Group();
  tilt.rotation.x = -Math.PI / 2;
  scene.add(tilt);
  const ring = new THREE.Group();
  tilt.add(ring);

  const R_OUT = 2.3;
  const R_IN = 1.5;
  const DEPTH = 0.42;
  const GAP = 0.03; // radians between segments
  const LIFT = 0.24; // how far a selected segment slides outward
  const GLOW = { rest: 0.3, active: 0.85, dim: 0.08 };

  let edge = Math.PI / 2; // 12 o'clock, then clockwise as seen from the camera
  const segments = model.entries.map((entry, i) => {
    const span = entry.share * Math.PI * 2;
    const sweep = Math.max(span - GAP, 0.004);
    const a1 = edge - GAP / 2;
    const a0 = a1 - sweep;
    edge -= span;

    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a1) * R_OUT, Math.sin(a1) * R_OUT);
    shape.absarc(0, 0, R_OUT, a1, a0, true);
    shape.absarc(0, 0, R_IN, a0, a1, false);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: Math.max(6, Math.round(sweep * 22)),
    });
    const color = new THREE.Color(entry.color);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: GLOW.rest,
      roughness: 0.45,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -DEPTH / 2;
    mesh.userData.index = i;
    ring.add(mesh);
    return { mesh, material, mid: a1 - sweep / 2, lift: 0, glow: GLOW.rest, color };
  });

  // Two hairline halos, like the rings around the hero's core.
  const halo = (radius, color, opacity) =>
    new THREE.Mesh(new THREE.TorusGeometry(radius, 0.007, 8, 240), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  const haloA = halo(2.95, 0xa78bfa, 0.45);
  haloA.rotation.set(Math.PI / 2 + 0.14, 0, 0);
  const haloB = halo(3.3, 0x5eead4, 0.25);
  haloB.rotation.set(Math.PI / 2 - 0.22, 0.3, 0);
  scene.add(haloA, haloB);

  // --- Interaction
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const pointerNow = new THREE.Vector2();
  const AUTO_SPEED = reduceMotion ? 0 : 0.12; // rad/s
  let spin = 0.4;
  let spinSpeed = AUTO_SPEED;
  let drag = null;
  let overSegment = false;
  let dirty = true;

  const toNdc = (e) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    return ndc;
  };
  const pick = (e) => {
    raycaster.setFromCamera(toNdc(e), camera);
    const hit = raycaster.intersectObjects(ring.children, false)[0];
    return hit ? hit.object.userData.index : -1;
  };

  canvas.addEventListener("pointermove", (e) => {
    pointerTarget.copy(toNdc(e));
    dirty = true;
    if (drag) {
      const dx = e.clientX - drag.x;
      const now = performance.now();
      drag.moved += Math.abs(dx);
      spin -= dx * 0.012;
      drag.speed = THREE.MathUtils.clamp((-dx * 0.012) / Math.max((now - drag.at) / 1000, 1 / 240), -6, 6);
      drag.x = e.clientX;
      drag.at = now;
      return;
    }
    const i = pick(e);
    overSegment = i >= 0;
    canvas.style.cursor = overSegment ? "pointer" : "";
    model.hover(i);
  });
  canvas.addEventListener("pointerleave", () => {
    pointerTarget.set(0, 0);
    overSegment = false;
    canvas.style.cursor = "";
    model.hover(-1);
    dirty = true;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, at: performance.now(), moved: 0, speed: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  const endDrag = (e) => {
    if (!drag) return;
    canvas.classList.remove("dragging");
    if (drag.moved < 4) {
      // a tap or click, not a drag
      model.toggle(pick(e));
      if (e.pointerType !== "mouse") model.hover(-1);
    } else {
      spinSpeed = drag.speed;
    }
    drag = null;
    dirty = true;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  model.onChange = () => {
    dirty = true;
    start();
  };

  // --- Size
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ringRenderer.setSize(w, h, false);
    dirty = true;
  };
  resize();
  new ResizeObserver(() => {
    resize();
    start();
  }).observe(host);

  // --- Render loop: only while the section is on screen and the tab visible
  let visible = false;
  let running = false;
  let shownAt = -1; // when the ring first came into view, for the entrance
  let last = 0;
  let elapsed = 0;
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  const update = (dt) => {
    const active = model.active;
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 10);

    if (!drag) spinSpeed += (((overSegment || model.hovered >= 0) ? 0 : AUTO_SPEED) - spinSpeed) * (1 - Math.exp(-dt * 2.5));
    spin += spinSpeed * dt;

    const entrance = reduceMotion || shownAt < 0 ? 1 : Math.min((elapsed - shownAt) / 1.2, 1);
    ring.rotation.z = -spin - (1 - ease(entrance)) * 0.9;

    segments.forEach((s, i) => {
      const wantLift = i === active ? LIFT : 0;
      const wantGlow = active < 0 ? GLOW.rest : i === active ? GLOW.active : GLOW.dim;
      s.lift += (wantLift - s.lift) * k;
      s.glow += (wantGlow - s.glow) * k;
      s.mesh.position.set(Math.cos(s.mid) * s.lift, Math.sin(s.mid) * s.lift, -DEPTH / 2);
      s.material.emissiveIntensity = s.glow;
      const dim = active < 0 || i === active ? 1 : 0.55;
      s.material.color.copy(s.color).multiplyScalar(dim);
      const a = reduceMotion || shownAt < 0 ? 1 : THREE.MathUtils.clamp((elapsed - shownAt - i * 0.07) / 0.9, 0, 1);
      s.mesh.scale.setScalar(Math.max(ease(a), 0.001));
    });

    pointerNow.lerp(pointerTarget, k * 0.5);
    camera.position.set(CAMERA_AT.x + pointerNow.x * 0.7, CAMERA_AT.y - pointerNow.y * 0.5, CAMERA_AT.z);
    camera.lookAt(0, 0, 0);
    haloA.rotation.z = elapsed * 0.06;
    haloB.rotation.z = -elapsed * 0.04;
  };

  const loop = () => {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    if (shownAt < 0) shownAt = elapsed;
    update(dt);
    if (!reduceMotion || dirty) {
      ringRenderer.render(scene, camera);
      dirty = false;
    }
    requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  };

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      start();
    },
    { threshold: 0.15 }
  ).observe(host);
  document.addEventListener("visibilitychange", start);
}

if (renderer) languagesReady.then((model) => model && mountStackRing(model));
