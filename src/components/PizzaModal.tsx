import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { makePizza, isWebGLAvailable } from "../three/world";
import type { PizzaDef } from "../data/pizzas";
import { formatPrice } from "../data/pizzas";

export default function PizzaModal({ pizza, onClose }: { pizza: PizzaDef; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [added, setAdded] = useState(false);
  const [glOk] = useState(isWebGLAvailable);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!glOk) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    camera.position.set(0, 1.9, 3.1);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.HemisphereLight(0x6a5138, 0x140d08, 1.1));
    const dir = new THREE.DirectionalLight(0xffd9a8, 1.6);
    dir.position.set(2.5, 4, 2);
    scene.add(dir);
    const warm = new THREE.PointLight(0xff8a3a, 14, 12, 1.8);
    warm.position.set(-1.5, 1.6, 1.8);
    scene.add(warm);

    const group = makePizza(pizza, { detail: "high", cooked: 1 });
    group.scale.setScalar(1.25);
    scene.add(group);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.42, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0x201813, roughness: 0.6 })
    );
    plate.position.y = -0.11;
    scene.add(plate);

    const size = () => {
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    window.addEventListener("resize", size);

    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.45;
      group.position.y = Math.sin(t * 0.9) * 0.05;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    };
  }, [pizza, glOk]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={pizza.name}
    >
      <button
        aria-label="Close"
        data-cursor="CLOSE"
        onClick={onClose}
        className="absolute inset-0 bg-soot/85 backdrop-blur-sm"
      />
      <div className="fade-up-in relative w-full max-w-3xl overflow-hidden border border-cream/10 bg-char shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
        <div className="grid md:grid-cols-2">
          <div className="img-fallback relative aspect-square md:aspect-auto md:min-h-[440px]">
            {glOk ? (
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            ) : (
              <img src={pizza.img} alt={pizza.name} className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="absolute left-4 top-4 font-display text-5xl text-cream/25">{pizza.no}</span>
            <span className="absolute bottom-4 left-4 font-hand text-2xl text-ember/90">{pizza.hand}</span>
          </div>
          <div className="flex flex-col justify-between gap-6 p-7 sm:p-9">
            <div>
              <p className="mb-3 text-[11px] tracking-[0.35em] text-tomato">WOOD FIRED · 420°</p>
              <h3 className="font-display text-4xl leading-none text-cream sm:text-5xl">{pizza.name}</h3>
              <p className="mt-4 font-body text-[13px] tracking-[0.18em] text-cream/70">
                {pizza.ingredients.join(" / ")}
              </p>
              <p className="mt-5 font-serif2 text-lg italic leading-snug text-parchment/90">{pizza.desc}</p>
            </div>
            <div>
              <div className="mb-6 flex items-end justify-between border-t border-cream/10 pt-5">
                <span className="font-display text-3xl text-cream">{formatPrice(pizza.price)}</span>
                <span className="text-[11px] tracking-[0.25em] text-cream/50">400G OF HAPPINESS</span>
              </div>
              <button
                data-cursor="OPEN"
                onClick={() => setAdded(true)}
                disabled={added}
                className={`w-full py-4 font-display text-xl tracking-wide transition-all duration-300 ${
                  added
                    ? "bg-olive text-cream"
                    : "bg-tomato text-cream hover:bg-ember hover:text-char active:scale-[0.98]"
                }`}
              >
                {added ? "ADDED — SEE YOU AT THE OVEN" : "ADD TO CRAVING"}
              </button>
              <button
                data-cursor="CLOSE"
                onClick={onClose}
                className="mt-3 w-full border border-cream/20 py-3 text-[12px] tracking-[0.3em] text-cream/70 transition-colors hover:border-tomato hover:text-cream"
              >
                BACK TO THE MENU
              </button>
            </div>
          </div>
        </div>
        <button
          aria-label="Close dialog"
          data-cursor="CLOSE"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center border border-cream/20 text-cream/70 transition-colors hover:border-tomato hover:text-cream"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
