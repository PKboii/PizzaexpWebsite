import * as THREE from "three";
import gsap from "gsap";
import type { PizzaDef, ToppingKind } from "../data/pizzas";
import { PIZZAS, INGREDIENTS_META } from "../data/pizzas";

/* ============================================================
   utils
============================================================ */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bell = (x: number, c: number, w: number) => {
  const d = Math.abs(x - c);
  return d > w ? 0 : smoothstep(w, 0, d);
};
const lerp = THREE.MathUtils.lerp;

function canvasTex(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  repeat = 1
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ============================================================
   procedural textures
============================================================ */
function speckle(
  ctx: CanvasRenderingContext2D,
  s: number,
  n: number,
  colors: string[],
  rMin: number,
  rMax: number,
  alpha = 1
) {
  const rnd = mulberry32(n * 7 + colors.length);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.25 + rnd() * 0.75);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const r = rMin + rnd() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const texDough = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#e3d0a8";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 900, ["#d9c394", "#eadbb8", "#cbb488", "#f0e2c2"], 0.6, 2.4, 0.5);
    speckle(ctx, s, 160, ["#b98d52", "#8a5f30"], 0.5, 1.6, 0.35);
  });

const texCrust = () =>
  canvasTex(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#d59e5c");
    g.addColorStop(0.5, "#c98d4b");
    g.addColorStop(1, "#d9a665");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 240, ["#a86f34", "#8f5a28", "#e8b877"], 1, 4, 0.5);
    speckle(ctx, s, 90, ["#3a2412", "#241407"], 1, 5, 0.55); // char blisters
  });

const texSauce = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#b92f16";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 500, ["#a02410", "#d0401f", "#8c1e0c", "#c23719"], 2, 9, 0.55);
    speckle(ctx, s, 120, ["#e05a2c"], 1, 3, 0.5);
  });

const texCream = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#ead9b6";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 420, ["#e0cc9f", "#f4e7c8", "#d6bf92"], 2, 8, 0.5);
  });

const texSalami = () =>
  canvasTex(128, (ctx, s) => {
    ctx.fillStyle = "#a52a1c";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 260, ["#f2e3d2", "#e8cdb8"], 0.6, 2.2, 0.85);
    speckle(ctx, s, 120, ["#7c150b", "#5e0f07"], 0.6, 2.6, 0.7);
  });

const texMushroom = () =>
  canvasTex(128, (ctx, s) => {
    ctx.fillStyle = "#c9a877";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 260, ["#b58f5c", "#dcc39a", "#8a6a3f"], 1, 4, 0.6);
  });

const texBrick = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#1c130d";
    ctx.fillRect(0, 0, s, s);
    const bw = s / 4;
    const bh = s / 8;
    const rnd = mulberry32(42);
    for (let r = 0; r < 8; r++) {
      for (let col = -1; col < 5; col++) {
        const x = col * bw + (r % 2 === 0 ? 0 : bw / 2);
        const shade = 22 + rnd() * 26;
        ctx.fillStyle = `rgb(${shade + 14},${shade + 4},${shade - 4})`;
        ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
        if (rnd() > 0.55) {
          ctx.fillStyle = "rgba(214,110,50,0.14)";
          ctx.fillRect(x + 2, r * bh + 2, bw - 4, (bh - 4) * 0.4);
        }
      }
    }
    speckle(ctx, s, 500, ["#000000", "#3a2517"], 0.5, 2, 0.4);
  }, 3);

const texWood = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#4a3120";
    ctx.fillRect(0, 0, s, s);
    const rnd = mulberry32(7);
    for (let i = 0; i < 6; i++) {
      const y = (s / 6) * i;
      ctx.fillStyle = i % 2 ? "#523823" : "#452d1c";
      ctx.fillRect(0, y, s, s / 6 - 3);
      ctx.fillStyle = "rgba(30,18,10,0.8)";
      ctx.fillRect(0, y + s / 6 - 3, s, 3);
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = `rgba(${60 + rnd() * 30},${38 + rnd() * 20},20,0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gy = y + rnd() * (s / 6);
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(s * 0.3, gy + rnd() * 4 - 2, s * 0.6, gy + rnd() * 4 - 2, s, gy);
        ctx.stroke();
      }
    }
  }, 4);

const texPlaster = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#241b14";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 1400, ["#2c2118", "#1d150f", "#332719", "#191009"], 0.5, 3, 0.5);
  }, 3);

const texMarble = () =>
  canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#d8d2c4";
    ctx.fillRect(0, 0, s, s);
    const rnd = mulberry32(21);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(120,114,102,${0.12 + rnd() * 0.2})`;
      ctx.lineWidth = 0.8 + rnd() * 1.6;
      ctx.beginPath();
      let x = rnd() * s, y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        x += rnd() * 30 - 15;
        y += 12 + rnd() * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    speckle(ctx, s, 300, ["#c9c2b2", "#e4ded2"], 0.5, 2, 0.5);
  });

const texPoster = (title: string, sub: string, bg: string, fg: string, accent: string) =>
  canvasTex(512, (ctx, s) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = accent;
    ctx.fillRect(24, 24, s - 48, 8);
    ctx.fillRect(24, s - 32, s - 48, 8);
    // pizza mark
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.36, s * 0.21, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.36, s * 0.155, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.36, s * 0.115, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    const rnd = mulberry32(title.length * 13);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(s / 2 + (rnd() - 0.5) * s * 0.17, s * 0.36 + (rnd() - 0.5) * s * 0.15, 8 + rnd() * 7, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.font = `64px Anton, sans-serif`;
    ctx.fillText(title, s / 2, s * 0.76);
    ctx.font = `24px "Space Grotesk", sans-serif`;
    ctx.fillText(sub, s / 2, s * 0.84);
    speckle(ctx, s, 700, [bg === "#f1e7d6" ? "#d8cbae" : "#000000"], 0.5, 2, 0.25);
  });

/* ============================================================
   materials
============================================================ */
const M = {
  dough: () => new THREE.MeshStandardMaterial({ map: texDough(), roughness: 0.92, metalness: 0 }),
  crust: () => new THREE.MeshStandardMaterial({ map: texCrust(), roughness: 0.85, metalness: 0 }),
  sauce: () =>
    new THREE.MeshPhysicalMaterial({ map: texSauce(), roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.35 }),
  cream: () => new THREE.MeshStandardMaterial({ map: texCream(), roughness: 0.8 }),
  mozz: () => new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.42, clearcoat: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xfff6e2) }),
  basil: () => new THREE.MeshStandardMaterial({ color: 0x3e7a34, roughness: 0.55, side: THREE.DoubleSide }),
  basilDark: () => new THREE.MeshStandardMaterial({ color: 0x2f5f28, roughness: 0.6, side: THREE.DoubleSide }),
  salami: () => new THREE.MeshStandardMaterial({ map: texSalami(), roughness: 0.62 }),
  chilli: () => new THREE.MeshStandardMaterial({ color: 0xc22f1c, roughness: 0.5 }),
  garlic: () => new THREE.MeshStandardMaterial({ color: 0xf0e6cd, roughness: 0.5 }),
  oregano: () => new THREE.MeshStandardMaterial({ color: 0x44522c, roughness: 0.8, side: THREE.DoubleSide }),
  thyme: () => new THREE.MeshStandardMaterial({ color: 0x5a6638, roughness: 0.8, side: THREE.DoubleSide }),
  mushroom: () => new THREE.MeshStandardMaterial({ map: texMushroom(), roughness: 0.75 }),
  burrata: () =>
    new THREE.MeshPhysicalMaterial({ color: 0xf8f2e4, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  tomatoFresh: () =>
    new THREE.MeshPhysicalMaterial({ color: 0xcc2f16, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  brick: () => new THREE.MeshStandardMaterial({ map: texBrick(), roughness: 0.95 }),
  stone: () => new THREE.MeshStandardMaterial({ color: 0x3a322b, roughness: 0.95 }),
  metal: () => new THREE.MeshStandardMaterial({ color: 0x191614, roughness: 0.45, metalness: 0.75 }),
  wood: () => new THREE.MeshStandardMaterial({ map: texWood(), roughness: 0.85 }),
  plaster: () => new THREE.MeshStandardMaterial({ map: texPlaster(), roughness: 0.95 }),
  marble: () => new THREE.MeshStandardMaterial({ map: texMarble(), roughness: 0.35, metalness: 0.05 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x17110d, roughness: 0.9 }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({ color: 0x8a9a5a, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55 }),
  oil: () =>
    new THREE.MeshPhysicalMaterial({ color: 0xd9a93c, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 }),
  stem: () => new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 0.6 }),
};

/* ============================================================
   pizza builder (single source of truth for toppings)
============================================================ */
export interface PizzaBuildOpts {
  detail?: "high" | "low";
  cooked?: number; // 0..1
}

function leafGeometry(size: number): THREE.ShapeGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(size * 0.5, size * 0.28, size * 0.62, size * 0.8, 0, size * 1.35);
  sh.bezierCurveTo(-size * 0.62, size * 0.8, -size * 0.5, size * 0.28, 0, 0);
  return new THREE.ShapeGeometry(sh, 6);
}

function scatter(rng: () => number, n: number, rMax: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * rMax;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export function makePizza(def: Pick<PizzaDef, "base" | "toppings">, opts: PizzaBuildOpts = {}): THREE.Group {
  const high = opts.detail !== "low";
  const seg = high ? 48 : 26;
  const g = new THREE.Group();
  const rng = mulberry32(1234);

  const crustMat = M.crust();
  const doughMat = M.dough();
  const sauceMat = M.sauce();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.16, seg), doughMat);
  g.add(base);

  const crust = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.135, high ? 14 : 9, seg), crustMat);
  crust.rotation.x = -Math.PI / 2;
  crust.scale.y = 1;
  crust.position.y = 0.09;
  crust.scale.set(1, 1, 0.72);
  g.add(crust);

  const sauce = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, seg),
    def.base === "sauce" ? sauceMat : M.cream()
  );
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.085;
  g.add(sauce);

  const addLeaf = (x: number, z: number, s: number, mat: THREE.Material) => {
    const leaf = new THREE.Mesh(leafGeometry(s), mat);
    leaf.position.set(x, 0.13, z);
    leaf.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.5;
    leaf.rotation.z = rng() * Math.PI * 2;
    g.add(leaf);
  };

  for (const t of def.toppings) {
    if (t === "mozz") {
      const n = high ? 8 : 5;
      const mozzMat = M.mozz();
      mozzMat.userData.isMozz = true;
      for (const [x, z] of scatter(rng, n, 0.62)) {
        const r = 0.13 + rng() * 0.09;
        const blob = new THREE.Mesh(new THREE.SphereGeometry(r, high ? 18 : 10, high ? 12 : 8), mozzMat);
        blob.position.set(x, 0.11, z);
        blob.scale.y = 0.42;
        blob.rotation.y = rng() * Math.PI;
        g.add(blob);
      }
    } else if (t === "basil") {
      const n = high ? 7 : 4;
      for (const [x, z] of scatter(rng, n, 0.6)) {
        addLeaf(x, z, 0.11 + rng() * 0.06, rng() > 0.5 ? M.basil() : M.basilDark());
      }
    } else if (t === "salami") {
      const n = high ? 9 : 6;
      for (const [x, z] of scatter(rng, n, 0.62)) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.024, high ? 20 : 12), M.salami());
        s.position.set(x, 0.115, z);
        s.rotation.y = rng() * Math.PI;
        g.add(s);
      }
    } else if (t === "chilli") {
      const n = high ? 26 : 14;
      for (const [x, z] of scatter(rng, n, 0.7)) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.02), M.chilli());
        f.position.set(x, 0.125, z);
        f.rotation.y = rng() * Math.PI;
        g.add(f);
      }
    } else if (t === "burrata") {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, high ? 24 : 14, high ? 16 : 10), M.burrata());
      b.position.y = 0.17;
      b.scale.set(1, 0.72, 1);
      g.add(b);
      const tear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.burrata());
      tear.position.set(0.14, 0.15, 0.1);
      tear.scale.y = 0.5;
      g.add(tear);
    } else if (t === "tomatoChunk") {
      const n = high ? 6 : 4;
      for (const [x, z] of scatter(rng, n, 0.6)) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.tomatoFresh());
        c.position.set(x, 0.115, z);
        c.scale.y = 0.5;
        g.add(c);
      }
    } else if (t === "mushroom") {
      const n = high ? 9 : 6;
      for (const [x, z] of scatter(rng, n, 0.62)) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, high ? 14 : 8, high ? 10 : 6, 0, Math.PI * 2, 0, Math.PI / 2), M.mushroom());
        cap.position.set(x, 0.1, z);
        cap.scale.y = 0.45;
        cap.rotation.y = rng() * Math.PI;
        g.add(cap);
      }
    } else if (t === "oregano" || t === "thyme") {
      const n = high ? 34 : 18;
      const mat = t === "oregano" ? M.oregano() : M.thyme();
      for (const [x, z] of scatter(rng, n, 0.7)) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.014), mat);
        f.position.set(x, 0.122, z);
        f.rotation.x = -Math.PI / 2;
        f.rotation.z = rng() * Math.PI;
        g.add(f);
      }
    } else if (t === "garlic") {
      const n = high ? 10 : 6;
      for (const [x, z] of scatter(rng, n, 0.6)) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.045), M.garlic());
        s.position.set(x, 0.12, z);
        s.rotation.y = rng() * Math.PI;
        g.add(s);
      }
    }
  }

  // cooking state --------------------------------------------------
  const crustBase = new THREE.Color(0xd9a665);
  const crustCooked = new THREE.Color(0x8f5a2c);
  const sauceBaseCol = new THREE.Color(0xffffff);
  const sauceCookedCol = new THREE.Color(0xc9c9c9);
  const setCooked = (t: number) => {
    const k = Math.min(1, Math.max(0, t));
    crustMat.color.copy(crustBase).lerp(crustCooked, k);
    sauceMat.color.copy(sauceBaseCol).lerp(sauceCookedCol, k);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshStandardMaterial;
        if (m.userData?.isMozz) {
          m.color.set(0xf2ead8).lerp(new THREE.Color(0xe8d3a0), k);
        }
      }
    });
  };
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const m = o.material as THREE.MeshStandardMaterial;
      if (m === crustMat) m.userData.isCrust = true;
    }
  });
  g.userData.setCooked = setCooked;

  if (opts.cooked) setCooked(opts.cooked);
  return g;
}

const mozzMark = (mesh: THREE.Object3D) => {
  mesh.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const m = o.material as THREE.MeshStandardMaterial;
      const mm = m as unknown as { sheen?: number; sheenColor?: THREE.Color };
      if (mm.sheen !== undefined && mm.sheenColor?.getHex?.() === 0xfff6e2) m.userData.isMozz = true;
    }
  });
};

/* ============================================================
   ingredient props
============================================================ */
function makeTomato(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), M.tomatoFresh());
  body.scale.y = 0.85;
  g.add(body);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(leafGeometry(0.07), M.basilDark());
    leaf.position.y = 0.2;
    leaf.rotation.x = -Math.PI / 2 + 0.5;
    leaf.rotation.z = (i / 5) * Math.PI * 2;
    g.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.08, 8), M.stem());
  stem.position.y = 0.24;
  g.add(stem);
  return g;
}
function makeMozzBall(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), M.mozz());
  b.scale.set(1, 0.85, 1);
  mozzMark(b);
  g.add(b);
  const t = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.mozz());
  t.position.set(0.14, -0.08, 0.05);
  g.add(t);
  return g;
}
function makeBasilSprig(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(leafGeometry(0.16), i % 2 ? M.basil() : M.basilDark());
    leaf.rotation.x = -0.4;
    leaf.rotation.z = (i - 1) * 0.9;
    leaf.position.x = (i - 1) * 0.1;
    g.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), M.stem());
  stem.position.y = -0.12;
  g.add(stem);
  return g;
}
function makeOilBottle(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.36, 14), M.glass());
  g.add(body);
  const oilIn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.3, 14), M.oil());
  oilIn.position.y = -0.02;
  g.add(oilIn);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 10), M.glass());
  neck.position.y = 0.24;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), M.metal());
  cap.position.y = 0.33;
  g.add(cap);
  return g;
}
function makeChilliPepper(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 12), M.chilli());
  body.rotation.z = Math.PI;
  body.rotation.y = 0.4;
  body.position.y = -0.05;
  const curve = new THREE.Group();
  curve.add(body);
  curve.rotation.z = 0.35;
  g.add(curve);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 8), M.stem());
  stem.position.y = 0.16;
  g.add(stem);
  return g;
}
function makeMushroomProp(): THREE.Group {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.mushroom());
  cap.scale.y = 0.72;
  cap.position.y = 0.08;
  g.add(cap);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 10), M.cream());
  stem.position.y = -0.02;
  g.add(stem);
  return g;
}

/* ============================================================
   particles
============================================================ */
function makePoints(count: number, spread: [number, number, number], color: number, size: number, additive = true) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const spd = new Float32Array(count);
  const rnd = mulberry32(count * 31 + size * 1000);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * spread[0];
    pos[i * 3 + 1] = (rnd() - 0.5) * spread[1];
    pos[i * 3 + 2] = (rnd() - 0.5) * spread[2];
    spd[i] = 0.3 + rnd() * 0.9;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.speeds = spd;
  return pts;
}

function animateRise(pts: THREE.Points, dt: number, speed: number, spanY: number) {
  const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
  const spd = pts.userData.speeds as Float32Array;
  for (let i = 0; i < attr.count; i++) {
    let y = attr.getY(i) + dt * speed * spd[i];
    if (y > spanY / 2) y = -spanY / 2;
    attr.setY(i, y);
  }
  attr.needsUpdate = true;
}

/* ============================================================
   camera keyframes
============================================================ */
interface Key {
  p: number;
  pos: [number, number, number];
  look: [number, number, number];
}
const KEYS: Key[] = [
  { p: 0.0, pos: [0, 1.3, 3.6], look: [0, 1.15, -14] },
  { p: 0.07, pos: [0, 1.2, -2.5], look: [0, 1.15, -16] },
  { p: 0.12, pos: [0, 1.2, -10], look: [0, 1.2, -24] },
  { p: 0.17, pos: [0, 1.28, -18.4], look: [0, 1.22, -24] },
  { p: 0.235, pos: [1.7, 1.7, -20.8], look: [0, 1.2, -24] },
  { p: 0.285, pos: [1.1, 1.5, -31], look: [0, 1.2, -38] },
  { p: 0.335, pos: [2.3, 1.6, -35.2], look: [0, 1.15, -38] },
  { p: 0.385, pos: [0, 1.24, -36.2], look: [0, 1.15, -38.2] },
  { p: 0.425, pos: [0, 1.36, -46], look: [0, 1.18, -52] },
  { p: 0.5, pos: [0.5, 1.3, -48.6], look: [0, 1.12, -52] },
  { p: 0.55, pos: [0, 1.2, -55.5], look: [0, 1.12, -64] },
  { p: 0.6, pos: [0, 1.16, -61.4], look: [0, 1.14, -66] },
  { p: 0.65, pos: [0, 1.16, -61.7], look: [0, 1.16, -66] },
  { p: 0.7, pos: [0, 1.22, -62.3], look: [0, 1.22, -66] },
  { p: 0.74, pos: [0, 1.24, -64.4], look: [0, 1.22, -66] },
  { p: 0.78, pos: [0, 1.22, -70], look: [0, 1.2, -82] },
  { p: 0.85, pos: [0, 1.22, -99], look: [0, 1.25, -114] },
  { p: 0.9, pos: [0, 1.55, -114], look: [0, 1.3, -142] },
  { p: 0.95, pos: [0.9, 1.5, -127], look: [-0.6, 1.25, -148] },
  { p: 1.0, pos: [0, 1.26, -159.6], look: [0, 1.24, -164] },
];

const FOG_KEYS: { p: number; color: THREE.Color; density: number }[] = [
  { p: 0.0, color: new THREE.Color(0x0b0705), density: 0.06 },
  { p: 0.1, color: new THREE.Color(0x170d06), density: 0.05 },
  { p: 0.2, color: new THREE.Color(0x150c06), density: 0.045 },
  { p: 0.32, color: new THREE.Color(0x1a1310), density: 0.05 },
  { p: 0.44, color: new THREE.Color(0x130e0a), density: 0.048 },
  { p: 0.56, color: new THREE.Color(0x150b05), density: 0.05 },
  { p: 0.63, color: new THREE.Color(0x261104), density: 0.075 },
  { p: 0.7, color: new THREE.Color(0x100904), density: 0.055 },
  { p: 0.78, color: new THREE.Color(0x0a0705), density: 0.07 },
  { p: 0.86, color: new THREE.Color(0x0c0806), density: 0.05 },
  { p: 0.92, color: new THREE.Color(0x150e09), density: 0.03 },
  { p: 1.0, color: new THREE.Color(0x070504), density: 0.045 },
];

export interface WorldCallbacks {
  onLabel: (label: { name: string; lines: string[]; x: number; y: number } | null) => void;
  onCursor: (state: "DRAG" | null) => void;
  onReady: () => void;
  onDoughHint: (active: boolean) => void;
}

/* ============================================================
   THE WORLD
============================================================ */
export class PizzaWorld {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private progress = 0;
  private camP = 0;
  private pointer = new THREE.Vector2(0, 0);
  private pointerClient = { x: 0, y: 0 };
  private raycaster = new THREE.Raycaster();
  private updaters: ((t: number, dt: number, p: number) => void)[] = [];
  private cbs: WorldCallbacks;
  private canvas: HTMLCanvasElement;
  private disposed = false;
  private isMobile: boolean;
  private dpr: number;
  private fpsEma = 60;
  private fpsFrames = 0;
  private lastLabelId: string | null = null;

  // stage refs
  private heroPizza!: THREE.Group;
  private dough!: THREE.Mesh;
  private doughMat!: THREE.MeshStandardMaterial;
  private buildPizza!: THREE.Group;
  private peel!: THREE.Group;
  private ovenDoor!: THREE.Mesh;
  private ovenGlowMat!: THREE.MeshStandardMaterial;
  private steam!: THREE.Points;
  private ingredients: { node: THREE.Group; kind: string; placed: boolean; baseAngle: number; speed: number; hit: THREE.Mesh }[] = [];
  private lights: Record<string, THREE.PointLight> = {};
  private bgPizzas: THREE.Group[] = [];
  private doughDragging = false;
  private doughVel = 0;
  private downPos = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, cbs: WorldCallbacks) {
    this.canvas = canvas;
    this.cbs = cbs;
    this.isMobile =
      typeof window !== "undefined" &&
      (window.matchMedia("(max-width: 820px)").matches || "ontouchstart" in window);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isMobile,
      powerPreference: "high-performance",
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 220);
    this.camera.position.set(0, 1.3, 3.6);

    this.scene.fog = new THREE.FogExp2(0x0b0705, 0.06);
    this.scene.background = new THREE.Color(0x0b0705);

    this.buildLights();
    this.buildStages();
    this.bindEvents();

    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
    requestAnimationFrame(() => cbs.onReady());
  }

  /* ---------------- lights ---------------- */
  private buildLights() {
    const hemi = new THREE.HemisphereLight(0x57422f, 0x120c08, 0.85);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffd9a8, 1.1);
    dir.position.set(3, 6, 2);
    this.scene.add(dir);

    const add = (key: string, color: number, intensity: number, dist: number, x: number, y: number, z: number) => {
      const l = new THREE.PointLight(color, intensity, dist, 1.8);
      l.position.set(x, y, z);
      l.userData.base = intensity;
      this.scene.add(l);
      this.lights[key] = l;
    };
    add("fire", 0xff7a2a, 26, 16, 0, 1.3, -13.2);
    add("hero", 0xffa64d, 16, 14, 1.5, 2.6, -21.5);
    add("dough", 0xffe0b0, 14, 12, 0.5, 2.8, -36);
    add("ing", 0xffb468, 15, 13, 0, 2.6, -50);
    add("oven2", 0xff6a1e, 22, 12, 0, 1.4, -64.6);
    add("room", 0xffb066, 26, 26, 0, 3.4, -128);
    add("roomOven", 0xff7a2a, 20, 16, 0, 1.4, -149);
    add("final", 0xff9c50, 24, 13, 0.5, 2.6, -161.5);
  }

  /* ---------------- stages ---------------- */
  private buildStages() {
    this.buildTunnel();
    this.buildHeroRoom();
    this.buildDoughStage();
    this.buildIngredientStage();
    this.buildOvenTwo();
    this.buildDive();
    this.buildRestaurant();
    this.buildFinal();
  }

  private buildTunnel() {
    const g = new THREE.Group();
    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.1, 20, 24, 1, true),
      new THREE.MeshStandardMaterial({ map: texBrick(), roughness: 0.96, side: THREE.BackSide })
    );
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.set(0, 1.4, -6);
    g.add(tunnel);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 22), M.stone());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, -7);
    g.add(floor);

    // oven mouth wall at z=-14 with glowing arch
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), M.brick());
    wall.position.set(0, 2.4, -14);
    g.add(wall);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.22, 10, 24, Math.PI), M.metal());
    arch.position.set(0, 1.05, -13.9);
    g.add(arch);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xff7a26, transparent: true, opacity: 0.95 })
    );
    glow.position.set(0, 1.05, -14.05);
    g.add(glow);

    const embers = makePoints(this.isMobile ? 110 : 240, [2.4, 3, 5], 0xffa14a, 0.05);
    embers.position.set(0, 1.2, -12.5);
    g.add(embers);
    this.updaters.push((_, dt) => animateRise(embers, dt, 0.9, 3));

    const flicker = this.lights.fire;
    this.updaters.push((t) => {
      const f = 0.75 + 0.25 * Math.sin(t * 11) * Math.sin(t * 23.7) + 0.1 * Math.sin(t * 47);
      flicker.intensity = 26 * Math.max(0.4, f);
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.max(0, f);
    });
    this.scene.add(g);
  }

  private buildHeroRoom() {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), new THREE.MeshStandardMaterial({ map: texWood(), roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -27);
    g.add(floor);

    this.heroPizza = makePizza(PIZZAS[1], { detail: "high", cooked: 1 });
    this.heroPizza.position.set(0, 1.22, -24);
    this.heroPizza.rotation.x = -0.35;
    mozzMark(this.heroPizza);
    g.add(this.heroPizza);
    this.updaters.push((t, dt) => {
      this.heroPizza.rotation.y += dt * 0.22;
      this.heroPizza.position.y = 1.22 + Math.sin(t * 0.8) * 0.05;
    });

    const bgDefs = [PIZZAS[0], PIZZAS[2], PIZZAS[4]];
    const bgPos: [number, number, number][] = [
      [-3.4, 2.3, -28.5],
      [3.6, 0.9, -27.5],
      [-2.6, 0.5, -30.5],
    ];
    const count = this.isMobile ? 1 : 3;
    for (let i = 0; i < count; i++) {
      const p = makePizza(bgDefs[i], { detail: "low", cooked: 1 });
      p.position.set(...bgPos[i]);
      p.scale.setScalar(0.55 + i * 0.1);
      p.rotation.set(-0.9, i * 1.7, 0.3 * i);
      g.add(p);
      this.bgPizzas.push(p);
    }
    this.updaters.push((t, dt) => {
      this.bgPizzas.forEach((p, i) => {
        p.rotation.z += dt * 0.05 * (i % 2 ? 1 : -1);
        p.position.y += Math.sin(t * 0.5 + i * 2) * dt * 0.03;
      });
    });

    const embers = makePoints(this.isMobile ? 60 : 120, [8, 3, 8], 0xff8a3a, 0.035);
    embers.position.set(0, 1.4, -24);
    g.add(embers);
    this.updaters.push((_, dt) => animateRise(embers, dt, 0.5, 3));
    this.scene.add(g);
  }

  private buildDoughStage() {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), M.dark());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -38);
    g.add(floor);

    const geo = new THREE.SphereGeometry(1.05, this.isMobile ? 56 : 96, this.isMobile ? 40 : 72);
    this.doughMat = M.dough();
    this.doughMat.userData.uTime = { value: 0 };
    this.doughMat.userData.uBulge = { value: new THREE.Vector3(0, 0, 1) };
    this.doughMat.userData.uBulgeAmt = { value: 0 };
    this.doughMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.doughMat.userData.uTime;
      shader.uniforms.uBulge = this.doughMat.userData.uBulge;
      shader.uniforms.uBulgeAmt = this.doughMat.userData.uBulgeAmt;
      shader.vertexShader =
        `uniform float uTime;\nuniform vec3 uBulge;\nuniform float uBulgeAmt;\n` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec3 nDir = normalize(normal);
          float n = sin(position.x*3.1 + uTime*0.9) * sin(position.y*4.2 - uTime*0.7) * sin(position.z*3.6 + uTime*0.8);
          float d = max(0.0, dot(nDir, normalize(uBulge)));
          transformed += nDir * (n * 0.045 + pow(d, 10.0) * uBulgeAmt);`
        );
    };
    this.dough = new THREE.Mesh(geo, this.doughMat);
    this.dough.position.set(0, 1.2, -38);
    g.add(this.dough);

    const flour = makePoints(this.isMobile ? 50 : 110, [5, 3, 5], 0xe8dcc0, 0.02, false);
    flour.position.set(0, 1.4, -38);
    (flour.material as THREE.PointsMaterial).opacity = 0.4;
    g.add(flour);
    this.updaters.push((t) => {
      flour.rotation.y = t * 0.05;
    });

    this.updaters.push((t, dt, p) => {
      const u = this.doughMat.userData;
      u.uTime.value = t;
      // pointer bulge (screen -> approximate object direction)
      const target = new THREE.Vector3(this.pointer.x * 1.4, this.pointer.y * 1.2 + 0.2, 1).normalize();
      (u.uBulge.value as THREE.Vector3).lerp(target, 1 - Math.exp(-dt * 5));
      const w = bell(p, 0.32, 0.09);
      u.uBulgeAmt.value += ((this.doughDragging ? 0.34 : 0.16) * w - u.uBulgeAmt.value) * (1 - Math.exp(-dt * 6));
      // stretch with scroll
      const s = smoothstep(0.3, 0.388, p);
      this.dough.scale.set(1 + 1.9 * s, 1 - 0.74 * s, 1 + 1.9 * s);
      // rotation: auto + drag inertia
      this.dough.rotation.y += dt * 0.25 + this.doughVel;
      this.doughVel *= Math.exp(-dt * 3);
      this.dough.position.y = 1.2 - 0.12 * s;
    });
    this.scene.add(g);
  }

  private buildIngredientStage() {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), M.dark());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -52);
    g.add(floor);

    // the pizza being built — margherita base, toppings arrive live
    this.buildPizza = makePizza({ base: "sauce", toppings: [] }, { detail: "high" });
    this.buildPizza.position.set(0, 1.12, -52);
    this.buildPizza.rotation.x = -0.28;
    g.add(this.buildPizza);
    this.updaters.push((_, dt, p) => {
      if (p < 0.52) this.buildPizza.rotation.y += dt * 0.18;
    });

    const defs: { kind: string; build: () => THREE.Group }[] = [
      { kind: "tomato", build: makeTomato },
      { kind: "mozz", build: makeMozzBall },
      { kind: "basil", build: makeBasilSprig },
      { kind: "oil", build: makeOilBottle },
      { kind: "chilli", build: makeChilliPepper },
      { kind: "mushroom", build: makeMushroomProp },
    ];
    const n = defs.length;
    defs.forEach((d, i) => {
      const node = new THREE.Group();
      const mesh = d.build();
      node.add(mesh);
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      node.add(hit);
      node.position.set(0, 1.35, -52);
      g.add(node);
      this.ingredients.push({ node, kind: d.kind, placed: false, baseAngle: (i / n) * Math.PI * 2, speed: 0.22 + (i % 3) * 0.05, hit });
    });

    this.updaters.push((t, dt, p) => {
      const active = p > 0.4 && p < 0.53;
      this.ingredients.forEach((ing, i) => {
        if (ing.placed) return;
        const a = ing.baseAngle + t * ing.speed;
        const r = 2.3 + Math.sin(t * 0.7 + i) * 0.15;
        ing.node.position.set(Math.cos(a) * r, 1.35 + Math.sin(t * 1.1 + i * 2) * 0.14, -52 + Math.sin(a) * r * 0.42);
        ing.node.rotation.y += dt * 0.6;
        ing.node.visible = p > 0.395;
        const sc = smoothstep(0.395, 0.425, p);
        ing.node.scale.setScalar(sc);
        if (!active) ing.hit.visible = false;
      });
    });
    this.scene.add(g);
  }

  /** add a visual topping to the building pizza when an ingredient lands */
  private landTopping(kind: string) {
    const rng = mulberry32(Date.now() % 100000);
    const pt = () => {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 0.58;
      return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
    };
    const pizza = this.buildPizza;
    if (kind === "mozz") {
      const mozzMat = M.mozz();
      mozzMat.userData.isMozz = true;
      for (let i = 0; i < 3; i++) {
        const [x, z] = pt();
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.13 + rng() * 0.06, 14, 10), mozzMat);
        b.position.set(x, 0.11, z);
        b.scale.y = 0.42;
        pizza.add(b);
      }
    } else if (kind === "basil") {
      for (let i = 0; i < 2; i++) {
        const [x, z] = pt();
        const leaf = new THREE.Mesh(leafGeometry(0.12), i % 2 ? M.basil() : M.basilDark());
        leaf.position.set(x, 0.13, z);
        leaf.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.4;
        leaf.rotation.z = rng() * Math.PI * 2;
        pizza.add(leaf);
      }
    } else if (kind === "tomato") {
      const splash = new THREE.Mesh(new THREE.CircleGeometry(0.2 + rng() * 0.12, 18), new THREE.MeshPhysicalMaterial({ color: 0x8c1e0c, roughness: 0.4, clearcoat: 0.6 }));
      const [x, z] = pt();
      splash.position.set(x, 0.09, z);
      splash.rotation.x = -Math.PI / 2;
      pizza.add(splash);
    } else if (kind === "oil") {
      pizza.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.MeshPhysicalMaterial).clearcoat !== undefined) {
          (o.material as THREE.MeshPhysicalMaterial).clearcoat = 0.9;
        }
      });
    } else if (kind === "chilli") {
      for (let i = 0; i < 10; i++) {
        const [x, z] = pt();
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.02), M.chilli());
        f.position.set(x, 0.125, z);
        f.rotation.y = rng() * Math.PI;
        pizza.add(f);
      }
    } else if (kind === "mushroom") {
      for (let i = 0; i < 3; i++) {
        const [x, z] = pt();
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.mushroom());
        cap.position.set(x, 0.1, z);
        cap.scale.y = 0.45;
        pizza.add(cap);
      }
    }
  }

  private placeIngredient(ing: (typeof this.ingredients)[number], instant = false) {
    if (ing.placed) return;
    ing.placed = true;
    const pizza = this.buildPizza;
    const target = new THREE.Vector3(
      pizza.position.x + (Math.random() - 0.5) * 0.5,
      pizza.position.y + 0.3,
      pizza.position.z + (Math.random() - 0.5) * 0.5
    );
    const worldPos = new THREE.Vector3();
    ing.node.getWorldPosition(worldPos);
    if (instant) {
      this.landTopping(ing.kind);
      ing.node.visible = false;
      return;
    }
    gsap.to(ing.node.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 0.65,
      ease: "power3.in",
      onComplete: () => {
        this.landTopping(ing.kind);
        ing.node.visible = false;
      },
    });
    gsap.to(ing.node.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 0.65, ease: "power2.in" });
  }

  private buildOvenTwo() {
    const g = new THREE.Group();
    g.position.set(0, 0, -66);

    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 1.05, 3.2), M.brick());
    base.position.y = 0.52;
    g.add(base);
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 3.4), M.stone());
    hearth.position.y = 1.12;
    g.add(hearth);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.brick());
    dome.scale.y = 0.72;
    dome.position.y = 1.19;
    g.add(dome);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.4, 12), M.brick());
    chimney.position.set(0, 3.1, -0.4);
    g.add(chimney);

    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 10, 22, Math.PI), M.metal());
    archTrim.position.set(0, 1.19, 2.28);
    g.add(archTrim);

    this.ovenGlowMat = new THREE.MeshStandardMaterial({
      color: 0x1a0c05,
      emissive: 0xff6a1e,
      emissiveIntensity: 1.4,
      roughness: 1,
    });
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.85, 22), this.ovenGlowMat);
    mouth.position.set(0, 1.19, 2.3);
    g.add(mouth);

    this.ovenDoor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.09), M.metal());
    this.ovenDoor.position.set(0, 2.7, 2.42);
    g.add(this.ovenDoor);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), M.wood());
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, -0.3, 0.09);
    this.ovenDoor.add(handle);

    // peel
    this.peel = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.5), M.wood());
    this.peel.add(blade);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), M.wood());
    stick.rotation.x = Math.PI / 2;
    stick.position.set(0, 0, 2);
    this.peel.add(stick);
    this.peel.position.set(0, -2, -66);
    this.peel.visible = false;
    this.scene.add(this.peel);

    // steam over revealed pizza
    this.steam = makePoints(this.isMobile ? 40 : 80, [1.2, 1.6, 1.2], 0xf5e9d8, 0.05, false);
    this.steam.position.set(0, 1.9, 2.7);
    (this.steam.material as THREE.PointsMaterial).opacity = 0;
    g.add(this.steam);

    this.updaters.push((t, dt, p) => {
      // pizza journey: -52 -> into oven -> out
      const toOven = smoothstep(0.52, 0.585, p);
      const out = smoothstep(0.685, 0.72, p);
      const zIn = -52, zDeep = -65.4, zOut = -63.3;
    const z = lerp(lerp(zIn, zDeep, toOven), zOut, out);
      const diveAlign = smoothstep(0.725, 0.755, p);
      const y = lerp(lerp(1.12, 1.3, toOven), 1.42 - 0.2 * diveAlign, out);
      this.buildPizza.position.set(0, y + Math.sin(t * 0.9) * 0.02 * (1 - toOven), z);
      this.buildPizza.rotation.x = -0.28 * (1 - toOven) - 0.0;
      if (out > 0) this.buildPizza.rotation.y += dt * 0.3 * out;

      // peel follows while sliding in
      this.peel.visible = toOven > 0.02 && toOven < 0.99;
      this.peel.position.set(0, y - 0.1, z + 0.1);

      // door
      const doorClosed = p > 0.585 && p < 0.69;
      const doorY = doorClosed ? 1.55 : 2.85;
      this.ovenDoor.position.y += (doorY - this.ovenDoor.position.y) * (1 - Math.exp(-dt * 5));

      // cook
      const cook = smoothstep(0.595, 0.665, p);
      this.buildPizza.userData.setCooked(cook);
      this.ovenGlowMat.emissiveIntensity = 1.2 + cook * 2.6 + Math.sin(t * 13) * 0.3;
      this.lights.oven2.intensity = 14 + cook * 26 + Math.sin(t * 17) * 3;

      // steam after reveal
      const st = smoothstep(0.7, 0.735, p);
      (this.steam.material as THREE.PointsMaterial).opacity = st * 0.5;
      if (st > 0.01) animateRise(this.steam, dt, 0.55, 1.6);
    });
    this.scene.add(g);
  }

  private buildDive() {
    const g = new THREE.Group();
    const crustMat = M.crust();
    const rnd = mulberry32(99);
    for (let i = 0; i < 10; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5 + rnd() * 0.6, 0.42 + rnd() * 0.25, 10, 26), crustMat);
      ring.position.set((rnd() - 0.5) * 0.8, 1.2 + (rnd() - 0.5) * 0.8, -76 - i * 3.1);
      ring.rotation.z = rnd() * Math.PI;
      g.add(ring);
      const sp = 0.05 + rnd() * 0.06;
      this.updaters.push((_, dt) => {
        ring.rotation.z += dt * sp * (i % 2 ? 1 : -1);
      });
    }
    const blobMats = [
      new THREE.MeshPhysicalMaterial({ color: 0xb92f16, roughness: 0.35, clearcoat: 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.5, sheen: 0.5 }),
      M.basil(),
      M.dark(),
    ];
    const nBlobs = this.isMobile ? 16 : 30;
    for (let i = 0; i < nBlobs; i++) {
      const type = Math.floor(rnd() * 4);
      let mesh: THREE.Mesh;
      if (type === 2) {
        mesh = new THREE.Mesh(leafGeometry(1.2 + rnd() * 1.6), blobMats[2]);
      } else if (type === 3) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5 + rnd(), 1.5 + rnd() * 2, 0.5 + rnd()), blobMats[3]);
      } else {
        const s = 0.35 + rnd() * 0.9;
        mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10), blobMats[type]);
        if (type === 1) mesh.scale.set(1.4, 0.8, 1.2);
      }
      const a = rnd() * Math.PI * 2;
      const r = 2.6 + rnd() * 2.4;
      mesh.position.set(Math.cos(a) * r, 1.2 + Math.sin(a) * r * 0.8, -76 - rnd() * 30);
      mesh.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      g.add(mesh);
    }
    const dust = makePoints(this.isMobile ? 80 : 160, [7, 5, 32], 0xf0c98a, 0.03);
    dust.position.set(0, 1.4, -91);
    g.add(dust);
    this.updaters.push((t) => {
      dust.rotation.z = t * 0.02;
    });
    this.scene.add(g);
  }

  private buildRestaurant() {
    const g = new THREE.Group();
    const Z0 = -112, Z1 = -152, ZC = (Z0 + Z1) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, Z1 - Z0 + 6), M.wood());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, ZC);
    g.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(15, Z1 - Z0 + 6), M.dark());
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.2, ZC);
    g.add(ceiling);

    const wallL = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0 + 6, 4.2), M.plaster());
    wallL.rotation.y = Math.PI / 2;
    wallL.position.set(-6.5, 2.1, ZC);
    g.add(wallL);
    const wallR = wallL.clone();
    wallR.rotation.y = -Math.PI / 2;
    wallR.position.x = 6.5;
    g.add(wallR);
    const wallB = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.2), M.brick());
    wallB.position.set(0, 2.1, Z1);
    g.add(wallB);

    // back oven
    const ovenBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 1.6), M.brick());
    ovenBase.position.set(0, 0.8, Z1 - 0.6);
    g.add(ovenBase);
    const ovenDome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.brick());
    ovenDome.scale.y = 0.7;
    ovenDome.position.set(0, 1.6, Z1 - 0.6);
    g.add(ovenDome);
    const ovenMouth = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 18),
      new THREE.MeshStandardMaterial({ color: 0x140803, emissive: 0xff6a1e, emissiveIntensity: 1.6 })
    );
    ovenMouth.position.set(0, 0.95, Z1 + 0.22);
    g.add(ovenMouth);
    this.updaters.push((t) => {
      (ovenMouth.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 12) * 0.35;
    });

    // bar counter (right)
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.05, 7), M.dark());
    barBase.position.set(4.6, 0.52, -124);
    g.add(barBase);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 7.3), M.marble());
    barTop.position.set(4.6, 1.09, -124);
    g.add(barTop);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 5.4), M.wood());
    shelf.position.set(6.2, 2.2, -124);
    g.add(shelf);
    const rnd = mulberry32(5);
    const bottleColors = [0x4c4829, 0x7a4a1e, 0x2e3a20, 0x8a2c14, 0x5a4a2a];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.5 + rnd() * 0.25, 10),
        new THREE.MeshPhysicalMaterial({ color: bottleColors[i % 5], roughness: 0.15, clearcoat: 0.8, transparent: true, opacity: 0.9 })
      );
      b.position.set(6.2, 2.5 + b.geometry.parameters.height / 2 - 0.3, -126.4 + i * 0.55);
      g.add(b);
    }

    // tables + chairs + candles
    const tableAt = (x: number, z: number, withGuests: boolean) => {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.72, 10), M.metal());
      ped.position.set(x, 0.36, z);
      g.add(ped);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), M.wood());
      top.position.set(x, 0.745, z);
      g.add(top);
      for (let i = 0; i < 2; i++) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4 }));
        plate.position.set(x + (i === 0 ? -0.25 : 0.25), 0.78, z + (i === 0 ? 0.05 : -0.08));
        g.add(plate);
      }
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.6 }));
      candle.position.set(x, 0.84, z);
      g.add(candle);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.07, 8),
        new THREE.MeshBasicMaterial({ color: 0xffc266 })
      );
      flame.position.set(x, 0.945, z);
      g.add(flame);
      this.updaters.push((t) => {
        flame.scale.y = 1 + Math.sin(t * 15 + x * 10) * 0.25;
      });
      const chairAt = (cx: number, cz: number, rot: number) => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), M.wood());
        seat.position.set(cx, 0.45, cz);
        seat.rotation.y = rot;
        g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), M.wood());
        back.position.set(cx - Math.sin(rot) * 0.19, 0.72, cz - Math.cos(rot) * 0.19);
        back.rotation.y = rot;
        g.add(back);
        for (let l = 0; l < 4; l++) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), M.metal());
          leg.position.set(cx + (l % 2 ? 0.16 : -0.16), 0.22, cz + (l < 2 ? 0.16 : -0.16));
          g.add(leg);
        }
      };
      chairAt(x - 0.95, z, Math.PI / 2);
      chairAt(x + 0.95, z, -Math.PI / 2);
      if (withGuests) {
        const guest = (gx: number, gz: number) => {
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), M.dark());
          body.position.set(gx, 0.82, gz);
          g.add(body);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M.dark());
          head.position.set(gx, 1.24, gz);
          g.add(head);
        };
        guest(x - 0.9, z);
        guest(x + 0.9, z);
      }
    };
    tableAt(-2.7, -120, true);
    tableAt(2.3, -130, false);
    tableAt(-2.4, -140, false);

    // hanging lamps
    const lampAt = (x: number, z: number) => {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 6), M.metal());
      cord.position.set(x, 3.45, z);
      g.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xc87f4e, roughness: 0.5, side: THREE.DoubleSide }));
      shade.position.set(x, 2.72, z);
      g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(x, 2.62, z);
      g.add(bulb);
      this.updaters.push((t) => {
        shade.rotation.z = Math.sin(t * 0.7 + z) * 0.03;
      });
    };
    lampAt(-2.7, -120);
    lampAt(0.2, -128);
    lampAt(-2.4, -140);

    // posters on left wall
    const posters: [string, string, string, string, string][] = [
      ["FIRE", "FIRST · DAL 1962", "#f1e7d6", "#17110d", "#d63b25"],
      ["FUOCO", "PIZZERIA · NAPOLI", "#d63b25", "#f1e7d6", "#17110d"],
      ["ONE MORE", "SLICE · SEMPRE", "#17110d", "#f1e7d6", "#c87f4e"],
    ];
    posters.forEach((p, i) => {
      const tex = texPoster(p[0], p[1], p[2], p[3], p[4]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.rotation.y = Math.PI / 2;
      m.position.set(-6.45, 2.3, -118 - i * 7);
      g.add(m);
    });

    // string lights
    for (let s = 0; s < 2; s++) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffc98a })
        );
        bulb.position.set(
          s === 0 ? -3 + Math.sin(t * Math.PI) * 1.2 : 3 - Math.sin(t * Math.PI) * 1.2,
          3.1 - Math.sin(t * Math.PI) * 0.7,
          -114 - t * 36
        );
        g.add(bulb);
      }
    }

    // window (right wall) with night glow
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ color: 0x101820 }));
    win.rotation.y = -Math.PI / 2;
    win.position.set(6.45, 2.3, -140);
    g.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.75, 2.75), M.dark());
    frame.position.set(6.44, 2.3, -140);
    g.add(frame);

    this.scene.add(g);
  }

  private buildFinal() {
    const g = new THREE.Group();
    const pizza = makePizza(PIZZAS[1], { detail: "high", cooked: 1 });
    pizza.position.set(0, 1.24, -164);
    pizza.rotation.x = -1.18;
    pizza.scale.setScalar(1.15);
    mozzMark(pizza);
    g.add(pizza);
    this.updaters.push((t, dt) => {
      pizza.rotation.z += dt * 0.15;
      pizza.position.y = 1.24 + Math.sin(t * 0.7) * 0.04;
    });
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x59150a, transparent: true, opacity: 0.65 })
    );
    glow.position.set(0, 1.24, -167.5);
    g.add(glow);
    const embers = makePoints(this.isMobile ? 60 : 120, [6, 4, 6], 0xff8a3a, 0.03);
    embers.position.set(0, 1, -164);
    g.add(embers);
    this.updaters.push((_, dt) => animateRise(embers, dt, 0.4, 4));
    this.scene.add(g);
  }

  /* ---------------- events ---------------- */
  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.pointerClient = { x: e.clientX, y: e.clientY };
    if (this.doughDragging) {
      this.doughVel = ((e as PointerEvent & { movementX?: number }).movementX ?? 0) * 0.0035;
    }
  };
  private onPointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
    if (this.doughChapterActive()) {
      this.doughDragging = true;
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    this.doughDragging = false;
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (Math.hypot(dx, dy) < 8) this.handleClick();
  };

  private doughChapterActive() {
    return this.camP > 0.26 && this.camP < 0.4;
  }

  private handleClick() {
    const hovered = this.hoveredIngredient();
    if (hovered) {
      this.placeIngredient(hovered);
      this.cbs.onLabel(null);
      this.cbs.onCursor(null);
      this.lastLabelId = null;
    }
  }

  private hoveredIngredient() {
    const w = bell(this.camP, 0.465, 0.065);
    if (w < 0.4) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.ingredients.filter((i) => !i.placed && i.node.visible).map((i) => i.hit),
      false
    );
    if (hits.length === 0) return null;
    const hit = hits[0].object as THREE.Mesh;
    return this.ingredients.find((i) => i.hit === hit) ?? null;
  }

  private bindEvents() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    window.addEventListener("pointerup", this.onPointerUp, { passive: true });
  }

  /* ---------------- per-frame ---------------- */
  setProgress(p: number) {
    this.progress = Math.min(1, Math.max(0, p));
  }

  private sampleKeys(p: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (p >= KEYS[i].p && p <= KEYS[i + 1].p) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const t = a.p === b.p ? 0 : smoothstep(a.p, b.p, p);
    const pos = new THREE.Vector3().lerpVectors(new THREE.Vector3(...a.pos), new THREE.Vector3(...b.pos), t);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(...a.look), new THREE.Vector3(...b.look), t);
    return { pos, look };
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    // damped progress
    this.camP += (this.progress - this.camP) * (1 - Math.exp(-dt * 3.4));
    const p = this.camP;

    // camera
    const { pos, look } = this.sampleKeys(p);
    const par = 0.14 * bell(p, 0.5, 0.5);
    pos.x += this.pointer.x * par;
    pos.y += this.pointer.y * par * 0.6;
    this.camera.position.lerp(pos, 1 - Math.exp(-dt * 5.5));
    const lookTarget = new THREE.Vector3().copy(look);
    this.camera.lookAt(lookTarget);

    // fog + background
    let fa = FOG_KEYS[0], fb = FOG_KEYS[FOG_KEYS.length - 1];
    for (let i = 0; i < FOG_KEYS.length - 1; i++) {
      if (p >= FOG_KEYS[i].p && p <= FOG_KEYS[i + 1].p) {
        fa = FOG_KEYS[i];
        fb = FOG_KEYS[i + 1];
        break;
      }
    }
    const ft = fa.p === fb.p ? 0 : smoothstep(fa.p, fb.p, p);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(fa.color).lerp(fb.color, ft);
    fog.density = lerp(fa.density, fb.density, ft);
    (this.scene.background as THREE.Color).copy(fog.color);

    // light presence by proximity
    const cz = this.camera.position.z;
    for (const [k, l] of Object.entries(this.lights)) {
      const d = Math.abs(l.position.z - cz);
      const base = k === "room" || k === "roomOven" ? 1 : Math.max(0, 1 - d / 14);
      l.userData.target = base;
      l.intensity += ((l.userData.base ?? l.intensity) * base - l.intensity) * (1 - Math.exp(-dt * 4));
    }
    // ingredient hover
    const hov = this.hoveredIngredient();
    const id = hov ? hov.kind : null;
    if (id !== this.lastLabelId) {
      this.lastLabelId = id;
      if (hov && hov.kind !== "tomato" && hov.kind !== "mozz" && hov.kind !== "basil" && hov.kind !== "oil" && hov.kind !== "chilli" && hov.kind !== "mushroom") {
        this.cbs.onLabel(null);
      } else if (hov) {
        const meta = INGREDIENTS_META[hov.kind];
        this.cbs.onLabel({ name: meta.name, lines: meta.lines, x: this.pointerClient.x, y: this.pointerClient.y });
        this.cbs.onCursor("DRAG");
      } else {
        this.cbs.onLabel(null);
        this.cbs.onCursor(null);
      }
    } else if (hov) {
      const meta = INGREDIENTS_META[hov.kind];
      this.cbs.onLabel({ name: meta.name, lines: meta.lines, x: this.pointerClient.x, y: this.pointerClient.y });
    }

    // auto-complete ingredients before leaving chapter
    if (p > 0.515) {
      for (const ing of this.ingredients) if (!ing.placed) this.placeIngredient(ing, true);
    }

    // dough hint
    this.cbs.onDoughHint(this.doughChapterActive());

    // stage animations
    for (const u of this.updaters) u(t, dt, p);

    // adaptive quality
    const fps = 1 / Math.max(dt, 0.001);
    this.fpsEma = this.fpsEma * 0.95 + fps * 0.05;
    this.fpsFrames++;
    if (this.fpsFrames > 180 && this.fpsEma < 34 && this.dpr > 0.75) {
      this.dpr = Math.max(0.75, this.dpr * 0.72);
      this.renderer.setPixelRatio(this.dpr);
      this.fpsFrames = 0;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
  }
}

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
