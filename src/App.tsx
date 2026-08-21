import { useEffect, useRef, useState } from "react";
import { PizzaWorld, isWebGLAvailable } from "./three/world";
import { PIZZAS, SIDES, DOLCI, DRINKS, IMG, formatPrice, type PizzaDef } from "./data/pizzas";
import PizzaModal from "./components/PizzaModal";
import Cursor from "./components/Cursor";

/* ---------------- helpers ---------------- */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function SafeImg({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`img-fallback relative overflow-hidden ${className}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 100 100" className="absolute left-1/2 top-1/2 h-2/5 w-2/5 -translate-x-1/2 -translate-y-1/2 opacity-40">
          <circle cx="50" cy="50" r="46" fill="#c87f4e" />
          <circle cx="50" cy="50" r="38" fill="#d63b25" />
          <circle cx="38" cy="42" r="7" fill="#f1e7d6" />
          <circle cx="60" cy="55" r="8" fill="#f1e7d6" />
          <circle cx="48" cy="64" r="5" fill="#3e7a34" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------- caption (3D overlay) ---------------- */
function Cap({
  range,
  className = "",
  children,
}: {
  range: [number, number];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-cap={`${range[0]},${range[1]}`} className={`pointer-events-none absolute opacity-0 will-change-transform ${className}`} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

const CHAPTERS = ["FIRE", "DOUGH", "CRAFT", "OVEN", "OUT", "INSIDE", "THE ROOM", "SLICE"];
const CHAPTER_RANGES: [number, number][] = [
  [0.0, 0.22],
  [0.25, 0.4],
  [0.4, 0.52],
  [0.52, 0.68],
  [0.68, 0.76],
  [0.76, 0.87],
  [0.87, 0.955],
  [0.955, 1.01],
];

/* ============================================================
   APP
============================================================ */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<PizzaWorld | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const labelBoxRef = useRef<HTMLDivElement>(null);
  const labelPos = useRef({ x: 0, y: 0, show: false });
  const tickRefs = useRef<(HTMLLIElement | null)[]>([]);

  const [mode, setMode] = useState<"boot" | "3d" | "2d">("boot");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<PizzaDef | null>(null);
  const [label, setLabel] = useState<{ name: string; lines: string[] } | null>(null);
  const [cursorWorld, setCursorWorld] = useState<string | null>(null);
  const [doughHint, setDoughHint] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  /* ---------- boot world ---------- */
  useEffect(() => {
    let disposed = false;
    const minLoad = new Promise((r) => setTimeout(r, 1100));
    if (!isWebGLAvailable() || !canvasRef.current) {
      setMode("2d");
      minLoad.then(() => !disposed && setLoading(false));
      return () => {
        disposed = true;
      };
    }
    try {
      const world = new PizzaWorld(canvasRef.current, {
        onLabel: (l) => {
          if (l) {
            labelPos.current = { x: l.x, y: l.y, show: true };
            setLabel((prev) => (prev?.name === l.name ? prev : { name: l.name, lines: l.lines }));
          } else {
            labelPos.current.show = false;
            setLabel((prev) => (prev === null ? prev : null));
          }
        },
        onCursor: (c) => setCursorWorld((prev) => (prev === c ? prev : c)),
        onReady: () => {
          setMode("3d");
          minLoad.then(() => !disposed && setLoading(false));
        },
        onDoughHint: (a) => setDoughHint((prev) => (prev === a ? prev : a)),
      });
      worldRef.current = world;
    } catch {
      setMode("2d");
      minLoad.then(() => !disposed && setLoading(false));
    }
    return () => {
      disposed = true;
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  /* ---------- scroll → world + captions ---------- */
  useEffect(() => {
    const caps = Array.from(document.querySelectorAll<HTMLElement>("[data-cap]")).map((el) => {
      const [a, b] = (el.dataset.cap || "0,1").split(",").map(Number);
      return { el, a, b };
    });
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const track = trackRef.current;
      if (!track) return;
      const max = track.offsetHeight - window.innerHeight;
      let p = clamp01(window.scrollY / Math.max(1, max));
      // gentle auto-drift through the oven mouth before the visitor scrolls
      if (window.scrollY < 20 && mode !== "2d") {
        const idle = clamp01((performance.now() - t0) / 6000);
        p = Math.max(p, idle * 0.036);
      }
      worldRef.current?.setProgress(p);

      for (const c of caps) {
        const o = sstep(c.a, c.a + 0.022, p) * (1 - sstep(c.b - 0.022, c.b, p));
        c.el.style.opacity = o.toFixed(3);
        c.el.style.transform = `translateY(${((1 - o) * 26).toFixed(1)}px)`;
        c.el.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      if (flashRef.current) {
        const d = Math.abs(p - 0.3925);
        flashRef.current.style.opacity = (d > 0.012 ? 0 : 1 - d / 0.012).toFixed(3);
      }
      if (railRef.current) {
        railRef.current.style.transform = `scaleY(${p.toFixed(4)})`;
      }
      tickRefs.current.forEach((el, i) => {
        if (!el) return;
        const [a, b] = CHAPTER_RANGES[i];
        const active = p >= a && p < b;
        el.style.opacity = active ? "1" : "0.32";
        el.style.color = active ? "#d63b25" : "";
      });
      if (labelBoxRef.current) {
        const lp = labelPos.current;
        labelBoxRef.current.style.opacity = lp.show ? "1" : "0";
        labelBoxRef.current.style.transform = `translate(${lp.x + 22}px, ${lp.y - 14}px)`;
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const is3d = mode === "3d" || mode === "boot";

  return (
    <div className="grain relative min-h-screen bg-soot text-cream">
      {/* ============ 3D canvas ============ */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-0 h-full w-full ${is3d ? "block" : "hidden"}`}
        aria-hidden="true"
      />

      {/* ============ loader ============ */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-soot transition-opacity duration-700 ${
          loading ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="animate-flicker flex flex-col items-center">
          <svg viewBox="0 0 64 64" className="mb-6 h-14 w-14">
            <circle cx="32" cy="32" r="30" fill="#d63b25" />
            <circle cx="32" cy="32" r="22" fill="#f1e7d6" />
            <circle cx="32" cy="32" r="16" fill="#d63b25" />
            <circle cx="25" cy="27" r="3.4" fill="#f1e7d6" />
            <circle cx="39" cy="36" r="3.4" fill="#f1e7d6" />
            <circle cx="29" cy="39" r="2.2" fill="#3e7a34" />
          </svg>
          <p className="font-display text-3xl tracking-wide text-cream">PIZZERIA FUOCO</p>
          <p className="mt-3 text-[11px] tracking-[0.5em] text-ember/80">HEATING THE OVEN</p>
        </div>
        <div className="mt-10 h-px w-44 overflow-hidden bg-cream/15">
          <div className="h-full w-full origin-left animate-pulse bg-tomato" />
        </div>
      </div>

      {/* ============ cursor / overlays ============ */}
      <Cursor worldState={cursorWorld} />

      {/* ingredient label */}
      <div ref={labelBoxRef} className="pointer-events-none fixed left-0 top-0 z-40 opacity-0 transition-opacity duration-150">
        {label && (
          <div className="border-l-2 border-tomato bg-soot/85 px-4 py-2 backdrop-blur-sm">
            <p className="font-display text-lg leading-none text-cream">{label.name}</p>
            <p className="mt-1 text-[10px] tracking-[0.3em] text-ember">{label.lines.join(" / ")}</p>
          </div>
        )}
      </div>

      {/* smash-cut flash */}
      <div ref={flashRef} className="pointer-events-none fixed inset-0 z-30 bg-cream" style={{ opacity: 0 }} />

      {/* dough hint */}
      <div
        className={`pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 transition-opacity duration-500 ${
          doughHint ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="font-hand text-2xl text-ember">drag it — it likes that</p>
      </div>

      {/* ============ nav ============ */}
      <header className="fixed inset-x-0 top-0 z-[60] mix-blend-difference">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" data-cursor="OPEN" className="flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="h-7 w-7">
              <circle cx="32" cy="32" r="30" fill="#d63b25" />
              <circle cx="32" cy="32" r="22" fill="#f1e7d6" />
              <circle cx="32" cy="32" r="16" fill="#d63b25" />
              <circle cx="25" cy="27" r="3.4" fill="#f1e7d6" />
              <circle cx="39" cy="36" r="3.4" fill="#f1e7d6" />
            </svg>
            <span className="font-display text-lg tracking-wide">PIZZERIA FUOCO</span>
          </a>
          <nav className="hidden items-center gap-8 text-[12px] tracking-[0.28em] md:flex">
            {[
              ["THE OVEN", "#top"],
              ["MENU", "#menu"],
              ["THE ROOM", "#room"],
              ["VISIT", "#visit"],
            ].map(([t, h]) => (
              <a key={t} href={h} data-cursor="OPEN" className="transition-colors hover:text-tomato">
                {t}
              </a>
            ))}
          </nav>
          <p className="flex items-center gap-2 text-[11px] tracking-[0.3em]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tomato" />
            OPEN 12—23
          </p>
        </div>
      </header>

      {/* progress rail + chapter ticks */}
      <div className="fixed left-5 top-1/2 z-[55] hidden -translate-y-1/2 mix-blend-difference lg:block">
        <div className="relative h-52 w-px bg-cream/20">
          <div ref={railRef} className="absolute inset-x-0 top-0 h-full origin-top bg-tomato" style={{ transform: "scaleY(0)" }} />
        </div>
      </div>
      <ul className="fixed right-6 top-1/2 z-[55] hidden -translate-y-1/2 space-y-2 text-right mix-blend-difference xl:block">
        {CHAPTERS.map((c, i) => (
          <li
            key={c}
            ref={(el) => {
              tickRefs.current[i] = el;
            }}
            className="text-[10px] tracking-[0.34em] transition-all duration-300"
            style={{ opacity: 0.32 }}
          >
            {String(i + 1).padStart(2, "0")} {c}
          </li>
        ))}
      </ul>

      {/* ============ WORLD TRACK ============ */}
      <div id="top" className="relative z-10">
        {mode !== "2d" ? (
          <div ref={trackRef} className="pointer-events-none relative" style={{ height: "1500vh" }} />
        ) : (
          <Track2D trackRef={trackRef} />
        )}

        {/* caption overlay for 3D */}
        {mode !== "2d" && (
          <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
            <Cap range={[0.004, 0.05]} className="left-6 top-24 sm:left-10">
              <p className="text-[11px] tracking-[0.5em] text-ember">NAPOLI / 01</p>
            </Cap>
            <Cap range={[0.03, 0.1]} className="bottom-[16vh] left-6 sm:left-10">
              <p className="font-display text-[13vw] leading-[0.9] text-cream text-shadow-warm sm:text-[9vw]">
                FIRE <span className="text-tomato">FIRST.</span>
              </p>
            </Cap>

            <Cap range={[0.12, 0.215]} className="left-1/2 top-[16vh] w-full -translate-x-1/2 text-center">
              <p className="font-display text-[17vw] leading-[0.82] text-cream text-shadow-deep sm:text-[13vw]">PIZZERIA</p>
              <p className="mt-2 font-hand text-3xl text-ember sm:text-4xl">fuoco — since the first spark</p>
            </Cap>
            <Cap range={[0.14, 0.215]} className="bottom-[15vh] left-6 sm:left-10">
              <p className="font-serif2 text-2xl italic text-parchment sm:text-4xl">FIRE. DOUGH. TIME.</p>
              <p className="mt-3 text-[11px] tracking-[0.42em] text-cream/70">OPEN DAILY / 12—23</p>
            </Cap>

            <Cap range={[0.235, 0.3]} className="right-6 top-[18vh] text-right sm:right-12">
              <p className="font-display text-[20vw] leading-[0.85] text-transparent [-webkit-text-stroke:2px_#d63b25] sm:text-[15vw]">FIRE</p>
              <p className="mt-2 text-[11px] tracking-[0.4em] text-ember">THE FIRST INGREDIENT.</p>
              <p className="mt-6 font-hand text-2xl text-cream/60">extra chilli? always.</p>
            </Cap>

            <Cap range={[0.285, 0.385]} className="left-6 top-[16vh] sm:left-10">
              <p className="font-display text-[20vw] leading-[0.85] text-cream sm:text-[15vw]">DOUGH</p>
              <p className="mt-2 font-serif2 text-xl italic text-parchment sm:text-3xl">START WITH SOMETHING SIMPLE.</p>
              <p className="mt-4 text-[11px] tracking-[0.4em] text-cream/60">FLOUR / WATER / SALT / PATIENCE</p>
            </Cap>

            <Cap range={[0.425, 0.475]} className="left-6 top-[15vh] sm:left-10">
              <p className="font-display text-[9vw] leading-[0.9] text-cream sm:text-[6vw]">MAKE IT BEAUTIFUL.</p>
            </Cap>
            <Cap range={[0.475, 0.52]} className="left-6 top-[15vh] sm:left-10">
              <p className="font-display text-[9vw] leading-[0.9] text-tomato text-shadow-warm sm:text-[6vw]">MAKE IT HOT.</p>
            </Cap>
            <Cap range={[0.43, 0.5]} className="bottom-[13vh] left-6 sm:left-10">
              <p className="font-hand text-2xl text-ember">tap an ingredient, feed the pizza</p>
              <p className="mt-3 text-[10px] tracking-[0.34em] text-cream/55">NO PINEAPPLE ARGUMENTS HERE.</p>
            </Cap>

            <Cap range={[0.585, 0.66]} className="left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="font-display text-[16vw] leading-none text-ember text-shadow-warm sm:text-[11vw]">420°</p>
              <p className="mt-3 font-display text-[8vw] tracking-wide text-cream sm:text-[5vw]">WAIT.</p>
              <p className="mt-4 text-[11px] tracking-[0.44em] text-cream/60">NO SHORTCUTS.</p>
            </Cap>

            <Cap range={[0.7, 0.755]} className="left-1/2 top-[14vh] w-full -translate-x-1/2 text-center">
              <p className="font-display text-[24vw] leading-[0.85] text-cream text-shadow-deep sm:text-[17vw]">OUT.</p>
              <p className="mt-1 font-serif2 text-2xl italic text-ember sm:text-4xl">NOW EAT.</p>
            </Cap>

            <Cap range={[0.79, 0.855]} className="left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="font-display text-[7vw] leading-[0.95] text-cream/90 sm:text-[4.5vw]">GOOD DOUGH. BAD HABITS.</p>
              <p className="mt-4 text-[10px] tracking-[0.4em] text-ember/80">DIVING THROUGH THE CRUST</p>
            </Cap>

            <Cap range={[0.885, 0.955]} className="bottom-[14vh] left-6 sm:left-10">
              <p className="font-display text-[13vw] leading-[0.88] text-cream text-shadow-deep sm:text-[9vw]">THE ROOM</p>
              <p className="mt-2 font-serif2 text-xl italic text-parchment sm:text-3xl">STAY A WHILE.</p>
            </Cap>

            <Cap range={[0.96, 1.005]} className="left-1/2 top-[15vh] w-full -translate-x-1/2 text-center">
              <p className="font-display text-[11vw] leading-[0.9] text-cream text-shadow-warm sm:text-[7vw]">ONE MORE SLICE.</p>
              <p className="mt-2 font-hand text-3xl text-ember">always</p>
            </Cap>
          </div>
        )}
      </div>

      {/* ============ CONTENT ============ */}
      <main className="relative z-20">
        {/* marquee */}
        <div className="overflow-hidden border-y border-char bg-tomato py-3 text-soot">
          <div className="animate-marquee flex w-max whitespace-nowrap font-display text-xl tracking-wide">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k} className="flex">
                {["FIRE FIRST", "GOOD DOUGH. BAD HABITS.", "NO SHORTCUTS", "ONE MORE SLICE", "COME HUNGRY", "STAY LATE"].map(
                  (s, i) => (
                    <span key={i} className="mx-6 flex items-center gap-6">
                      {s} <span className="inline-block h-2.5 w-2.5 rounded-full bg-soot/80" />
                    </span>
                  )
                )}
              </span>
            ))}
          </div>
        </div>

        {/* ---------------- MENU ---------------- */}
        <section id="menu" className="scroll-mt-16 bg-cream py-24 text-char sm:py-32">
          <div className="px-6 sm:px-12">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-[11px] tracking-[0.45em] text-tomato">CHAPTER / IL MENU</p>
                  <h2 className="mt-3 font-display text-6xl leading-[0.88] sm:text-8xl">
                    FIVE PIZZAS.
                    <br />
                    <span className="text-tomato">NO COMPROMISES.</span>
                  </h2>
                </div>
                <div className="max-w-xs">
                  <p className="font-serif2 text-lg italic leading-snug text-char/80">
                    A short menu is a confident menu. Each one leaves the oven in ninety seconds or it doesn't leave at all.
                  </p>
                  <p className="mt-3 font-hand text-2xl text-tomato">tap a pizza → it spins for you</p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="menu-scroll mt-16 flex snap-x snap-mandatory gap-8 overflow-x-auto px-6 pb-8 sm:px-12">
            {PIZZAS.map((pz, i) => (
              <Reveal key={pz.id} delay={i * 70} className="snap-start">
                <button
                  data-cursor="VIEW"
                  onClick={() => setModal(pz)}
                  className="group block w-[262px] text-left transition-transform duration-500 hover:-translate-y-3 hover:rotate-[0.8deg] sm:w-[300px]"
                >
                  <div className="relative overflow-hidden rounded-full border-[6px] border-char bg-parchment shadow-[0_24px_60px_rgba(23,17,13,0.25)] transition-shadow duration-500 group-hover:shadow-[0_36px_80px_rgba(214,59,37,0.35)]">
                    <SafeImg
                      src={pz.img}
                      alt={`${pz.name} pizza`}
                      className="aspect-square w-full rounded-full object-cover transition-transform duration-700 group-hover:scale-[1.06] group-hover:rotate-2"
                    />
                    <span className="absolute left-1/2 top-4 -translate-x-1/2 font-display text-sm tracking-widest text-cream drop-shadow">
                      {pz.no}
                    </span>
                  </div>
                  <div className="mt-6 flex items-baseline justify-between">
                    <h3 className="font-display text-3xl">{pz.name}</h3>
                    <span className="font-display text-2xl text-tomato">{formatPrice(pz.price)}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] tracking-[0.22em] text-char/60">{pz.ingredients.join(" / ")}</p>
                  <p className="mt-3 font-serif2 italic leading-snug text-char/75">{pz.desc}</p>
                </button>
              </Reveal>
            ))}
            <Reveal delay={350} className="flex snap-start items-center">
              <div className="flex h-[262px] w-[220px] flex-col items-center justify-center gap-3 border-2 border-dashed border-char/30 text-center sm:h-[300px]">
                <p className="font-hand text-3xl text-tomato">that's the list.</p>
                <p className="px-6 text-[11px] tracking-[0.3em] text-char/60">SHORT ON PURPOSE</p>
              </div>
            </Reveal>
          </div>

          {/* sides / dolci / drinks */}
          <div className="mt-20 bg-char px-6 py-16 text-cream sm:px-12 sm:py-20">
            <div className="grid gap-12 md:grid-cols-3">
              {[
                ["SIDES", SIDES],
                ["DOLCI", DOLCI],
                ["DRINKS", DRINKS],
              ].map(([title, items], ci) => (
                <Reveal key={title as string} delay={ci * 90}>
                  <h4 className="flex items-center gap-3 font-display text-2xl tracking-wide">
                    <span className="h-2 w-2 bg-tomato" /> {title as string}
                  </h4>
                  <ul className="mt-6 space-y-5">
                    {(items as { name: string; price: number; note?: string }[]).map((it) => (
                      <li key={it.name}>
                        <div className="flex items-baseline gap-3">
                          <span className="font-body text-[13px] font-medium tracking-[0.14em]">{it.name}</span>
                          <span className="mx-1 flex-1 border-b border-dotted border-cream/25" />
                          <span className="font-display text-lg text-ember">{formatPrice(it.price)}</span>
                        </div>
                        {it.note && <p className="mt-1 font-serif2 text-sm italic text-cream/55">{it.note}</p>}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
            <p className="mt-14 text-center font-hand text-3xl text-ember/90">napkins are optional. opinions are not.</p>
          </div>
        </section>

        {/* ---------------- THE ROOM ---------------- */}
        <section id="room" className="scroll-mt-16 overflow-hidden bg-soot py-24 sm:py-32">
          <div className="px-6 sm:px-12">
            <Reveal>
              <p className="text-[11px] tracking-[0.45em] text-ember">CHAPTER / THE ROOM</p>
              <h2 className="mt-3 font-display text-6xl leading-[0.88] text-cream sm:text-8xl">
                STAY <span className="outline-word text-cream">A WHILE.</span>
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-6 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <div className="group relative overflow-hidden">
                  <SafeImg src={IMG.room} alt="The dining room with the wood-fired oven glowing" className="animate-kenburns h-[46vh] w-full object-cover sm:h-[62vh]" eager />
                  <div className="absolute inset-0 bg-gradient-to-t from-soot/80 via-transparent to-transparent" />
                  <p className="absolute bottom-5 left-6 font-serif2 text-xl italic text-parchment">
                    twelve tables. one oven. zero rush.
                  </p>
                </div>
              </Reveal>
              <div className="flex flex-col gap-6 lg:col-span-5">
                <Reveal delay={120}>
                  <div className="relative overflow-hidden">
                    <SafeImg src={IMG.counter} alt="The marble bar counter with bottles and candlelight" className="h-[30vh] w-full object-cover transition-transform duration-700 hover:scale-[1.04] sm:h-[38vh]" />
                    <p className="absolute bottom-4 right-5 font-hand text-2xl text-ember">the waiting bar</p>
                  </div>
                </Reveal>
                <Reveal delay={200}>
                  <div className="flex flex-1 flex-col justify-between border border-cream/10 bg-coal p-8">
                    <p className="font-serif2 text-2xl italic leading-relaxed text-parchment">
                      The room smells like char and tomatoes. The playlist argues with itself. Nobody checks the time — except the
                      pizzaiolo, who checks the dough.
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 text-[11px] tracking-[0.28em] text-cream/60">
                      <p>36 SEATS</p>
                      <p>1 WOOD OVEN</p>
                      <p>90-SECOND BAKE</p>
                      <p>LATE-NIGHT VIBES</p>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- THE TABLE ---------------- */}
        <section className="relative overflow-hidden bg-char">
          <div className="relative h-[92vh] min-h-[540px]">
            <SafeImg src={IMG.table} alt="A pizza on the table with wine, candlelight and olive oil" className="animate-kenburns absolute inset-0 h-full w-full object-cover" eager />
            <div className="absolute inset-0 bg-gradient-to-r from-soot/85 via-soot/30 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-center px-6 sm:px-12">
              <Reveal>
                <p className="text-[11px] tracking-[0.45em] text-ember">CHAPTER / THE TABLE</p>
                <h2 className="mt-4 font-display text-[15vw] leading-[0.86] text-cream text-shadow-deep sm:text-[9vw]">
                  ONE MORE
                  <br />
                  SLICE.
                </h2>
                <p className="mt-5 font-serif2 text-3xl italic text-parchment sm:text-5xl">ALWAYS.</p>
                <p className="mt-6 font-hand text-3xl text-ember">cold pizza at 2am counts as breakfast</p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- NIGHT / LAST TABLE ---------------- */}
        <section className="relative overflow-hidden bg-soot py-28 sm:py-36">
          {/* css embers */}
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="ember absolute bottom-[8%] h-1.5 w-1.5 rounded-full bg-ember"
                style={{
                  left: `${8 + i * 9}%`,
                  animationDuration: `${5 + (i % 4) * 2.4}s`,
                  animationDelay: `${i * 0.7}s`,
                  opacity: 0,
                }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 55% at 50% 100%, rgba(214,59,37,0.22), transparent 70%)" }}
          />
          <div className="relative px-6 text-center sm:px-12">
            <Reveal>
              <p className="text-[11px] tracking-[0.5em] text-tomato">23:40 — THE LAST TABLE</p>
              <h2 className="mx-auto mt-6 max-w-5xl font-display text-[16vw] leading-[0.85] sm:text-[11vw]">
                <span className="outline-word text-tomato">LAST</span> <span className="text-cream">TABLE.</span>
              </h2>
              <p className="mt-6 font-serif2 text-2xl italic text-parchment sm:text-4xl">ONE MORE SLICE.</p>
              <p className="mt-8 text-[11px] tracking-[0.4em] text-cream/50">THE OVEN SLEEPS AT MIDNIGHT. WE DON'T.</p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- FINAL CTA ---------------- */}
        <section id="book" className="relative scroll-mt-16 overflow-hidden border-t border-cream/5 bg-[#0a0705] py-28 sm:py-36">
          <div className="pointer-events-none absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full bg-tomato/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-6 text-center sm:px-12">
            <Reveal>
              <div className="relative mx-auto mb-12 h-52 w-52 sm:h-72 sm:w-72">
                <div className="absolute inset-0 rounded-full bg-tomato/15 blur-2xl" />
                <SafeImg
                  src={PIZZAS[1].img}
                  alt="Margherita pizza rotating slowly"
                  className="animate-spin-slower relative h-full w-full rounded-full object-cover shadow-[0_30px_90px_rgba(214,59,37,0.35)]"
                  eager
                />
              </div>
              <h2 className="font-display text-[15vw] leading-[0.85] text-cream sm:text-[10vw]">
                COME <span className="text-tomato">HUNGRY.</span>
              </h2>
              <p className="mt-4 font-serif2 text-3xl italic text-parchment sm:text-5xl">LEAVE HAPPY.</p>
            </Reveal>

            <Reveal delay={150}>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  data-cursor="OPEN"
                  onClick={() => setBookOpen((v) => !v)}
                  className="w-full max-w-xs bg-tomato px-10 py-5 font-display text-2xl tracking-wide text-cream transition-all duration-300 hover:bg-ember hover:text-char active:scale-[0.97] sm:w-auto"
                >
                  BOOK A TABLE
                </button>
                <a
                  data-cursor="OPEN"
                  href="#menu"
                  className="w-full max-w-xs border border-cream/30 px-10 py-5 font-display text-2xl tracking-wide text-cream transition-colors duration-300 hover:border-tomato hover:text-tomato sm:w-auto"
                >
                  ORDER PIZZA
                </a>
              </div>

              {bookOpen && (
                <div className="fade-up-in mx-auto mt-10 max-w-md border border-cream/10 bg-coal p-7 text-left">
                  {booked ? (
                    <div className="py-4 text-center">
                      <p className="font-display text-3xl text-ember">TAVOLO CONFIRMED.</p>
                      <p className="mt-3 font-serif2 italic text-parchment">We'll hold it for fifteen minutes. After that, the oven decides.</p>
                      <p className="mt-4 font-hand text-2xl text-tomato">see you at the oven</p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setBooked(true);
                      }}
                      className="space-y-4"
                    >
                      <p className="font-display text-xl tracking-wide text-cream">TONIGHT?</p>
                      <input
                        required
                        placeholder="YOUR NAME"
                        className="w-full border border-cream/15 bg-soot px-4 py-3 text-sm tracking-[0.15em] text-cream placeholder:text-cream/35 focus:border-tomato focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <select className="w-full border border-cream/15 bg-soot px-4 py-3 text-sm tracking-[0.15em] text-cream focus:border-tomato focus:outline-none" defaultValue="20:00">
                          {["12:00", "13:30", "18:00", "19:30", "20:00", "21:30", "22:30"].map((t) => (
                            <option key={t} value={t} className="bg-soot">
                              {t}
                            </option>
                          ))}
                        </select>
                        <select className="w-full border border-cream/15 bg-soot px-4 py-3 text-sm tracking-[0.15em] text-cream focus:border-tomato focus:outline-none" defaultValue="2">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n} className="bg-soot">
                              {n} {n === 1 ? "GUEST" : "GUESTS"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button data-cursor="OPEN" type="submit" className="w-full bg-tomato py-4 font-display text-lg tracking-wide text-cream transition-colors hover:bg-ember hover:text-char">
                        CONFIRM
                      </button>
                    </form>
                  )}
                </div>
              )}
            </Reveal>
          </div>
        </section>

        {/* ---------------- LOCATION ---------------- */}
        <section id="visit" className="scroll-mt-16 border-t border-cream/5 bg-soot py-24 sm:py-32">
          <div className="grid gap-12 px-6 sm:px-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-[11px] tracking-[0.45em] text-ember">CHAPTER / FIND US</p>
              <h2 className="mt-3 font-display text-6xl leading-[0.88] text-cream sm:text-7xl">
                VIA DEI <span className="text-tomato">TRIBUNALI.</span>
              </h2>
              <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
                <div>
                  <p className="text-[10px] tracking-[0.4em] text-cream/50">PIZZERIA</p>
                  <p className="mt-2 font-display text-xl text-cream">FUOCO</p>
                  <p className="mt-1 text-cream/70">Via dei Tribunali 21</p>
                  <p className="text-cream/70">80138 Napoli, IT</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.4em] text-cream/50">OPEN</p>
                  <p className="mt-2 font-display text-xl text-cream">12:00 — 23:00</p>
                  <p className="mt-1 text-cream/70">every day. the oven disagrees with Mondays but opens anyway.</p>
                </div>
              </div>
              {/* abstract map */}
              <div className="mt-10 border border-cream/10 bg-coal p-4">
                <svg viewBox="0 0 400 240" className="w-full">
                  <g stroke="rgba(241,231,214,0.14)" strokeWidth="6" strokeLinecap="round">
                    <path d="M20 190 L150 170 L260 185 L390 150" fill="none" />
                    <path d="M60 30 L110 120 L150 170" fill="none" />
                    <path d="M340 20 L300 100 L260 185" fill="none" />
                    <path d="M20 80 L110 120 L300 100" fill="none" />
                  </g>
                  <path d="M20 190 L150 170 L260 185" fill="none" stroke="#d63b25" strokeWidth="2.5" className="route-anim" />
                  <circle cx="260" cy="185" r="16" fill="rgba(214,59,37,0.18)">
                    <animate attributeName="r" values="12;22;12" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="260" cy="185" r="7" fill="#d63b25" />
                  <text x="260" y="160" textAnchor="middle" fill="#f1e7d6" fontSize="13" fontFamily="Anton, sans-serif" letterSpacing="2">
                    PIZZERIA FUOCO
                  </text>
                  <text x="30" y="205" fill="rgba(241,231,214,0.45)" fontSize="9" fontFamily="Space Grotesk, sans-serif" letterSpacing="2">
                    YOU, PROBABLY LOST
                  </text>
                </svg>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="relative h-full min-h-[420px] overflow-hidden">
                <SafeImg src={IMG.street} alt="The pizzeria glowing on a narrow Naples street at night" className="animate-kenburns absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-soot via-transparent to-transparent" />
                <p className="absolute bottom-5 left-6 font-hand text-3xl text-ember">look for the glow</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- FOOTER ---------------- */}
        <footer className="border-t border-cream/8 bg-black pb-10 pt-16">
          <div className="px-6 sm:px-12">
            <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 64 64" className="h-9 w-9">
                    <circle cx="32" cy="32" r="30" fill="#d63b25" />
                    <circle cx="32" cy="32" r="22" fill="#f1e7d6" />
                    <circle cx="32" cy="32" r="16" fill="#d63b25" />
                    <circle cx="25" cy="27" r="3.4" fill="#f1e7d6" />
                    <circle cx="39" cy="36" r="3.4" fill="#f1e7d6" />
                    <circle cx="29" cy="39" r="2.2" fill="#3e7a34" />
                  </svg>
                  <p className="font-display text-2xl tracking-wide text-cream">PIZZERIA FUOCO</p>
                </div>
                <p className="mt-4 max-w-xs font-serif2 italic leading-relaxed text-cream/60">
                  Serious about pizza. Not serious about anything else. Napoli, since the first spark.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] tracking-[0.4em] text-cream/45">FIND US</p>
                  <p className="mt-3 text-sm leading-relaxed text-cream/80">
                    Via dei Tribunali 21
                    <br />
                    80138 Napoli, IT
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.4em] text-cream/45">HOURS</p>
                  <p className="mt-3 text-sm leading-relaxed text-cream/80">
                    Open daily
                    <br />
                    12:00 — 23:00
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.4em] text-cream/45">DO THINGS</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>
                      <a data-cursor="OPEN" href="#book" className="text-cream/80 transition-colors hover:text-tomato">
                        Reservation
                      </a>
                    </li>
                    <li>
                      <a data-cursor="OPEN" href="#menu" className="text-cream/80 transition-colors hover:text-tomato">
                        Order
                      </a>
                    </li>
                    <li>
                      <a
                        data-cursor="OPEN"
                        href="https://www.instagram.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cream/80 transition-colors hover:text-tomato"
                      >
                        Instagram
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-16 border-t border-cream/10 pt-8 text-center">
              <p className="font-display text-[9vw] leading-none text-cream/90 sm:text-[5.5vw]">
                SEE YOU <span className="text-tomato">AT THE OVEN.</span>
              </p>
              <p className="mt-6 text-[10px] tracking-[0.35em] text-cream/40">© {new Date().getFullYear()} PIZZERIA FUOCO — A FICTIONAL PIZZERIA, UNFORTUNATELY</p>
            </div>
          </div>
        </footer>
      </main>

      {/* ============ modal ============ */}
      {modal && <PizzaModal pizza={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ============================================================
   2D FALLBACK TRACK (no WebGL)
============================================================ */
function Track2D({ trackRef }: { trackRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div ref={trackRef} className="pointer-events-none relative">
      {[
        { img: PIZZAS[1].img, k1: "FIRE FIRST.", k2: "NAPOLI / 01", alt: "Margherita pizza" },
        { img: PIZZAS[2].img, k1: "GOOD DOUGH. BAD HABITS.", k2: "DIAVOLA HEAT", alt: "Diavola pizza" },
        { img: IMG.room, k1: "THE ROOM", k2: "STAY A WHILE", alt: "The dining room" },
        { img: IMG.table, k1: "ONE MORE SLICE.", k2: "ALWAYS", alt: "A pizza on the table" },
      ].map((s, i) => (
        <section key={i} className="relative flex h-screen items-end overflow-hidden">
          <SafeImg src={s.img} alt={s.alt} className="absolute inset-0 h-full w-full object-cover" eager={i === 0} />
          <div className="absolute inset-0 bg-gradient-to-t from-soot via-soot/35 to-soot/70" />
          <div className="relative p-8 pb-16">
            <p className="text-[11px] tracking-[0.5em] text-ember">{s.k2}</p>
            <p className="mt-3 font-display text-6xl leading-[0.9] text-cream sm:text-8xl">{s.k1}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
