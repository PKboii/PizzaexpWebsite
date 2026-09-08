import { useEffect, useRef } from "react";

export default function Cursor({ worldState }: { worldState: string | null }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const elemState = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const pos = { x: -100, y: -100 };
    const ring = { x: -100, y: -100 };
    let visible = false;
    let down = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        if (dotRef.current) dotRef.current.style.opacity = "1";
        if (ringRef.current) ringRef.current.style.opacity = "1";
      }
      const el = (e.target as HTMLElement)?.closest?.("[data-cursor]") as HTMLElement | null;
      elemState.current = el?.dataset.cursor ?? null;
    };
    const onDown = () => (down = true);
    const onUp = () => (down = false);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      ring.x += (pos.x - ring.x) * 0.16;
      ring.y += (pos.y - ring.y) * 0.16;
      if (dotRef.current) dotRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      const label = worldState ?? elemState.current;
      const big = !!label || down;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.x}px, ${ring.y}px)`;
        ringRef.current.style.width = big ? "72px" : "34px";
        ringRef.current.style.height = big ? "72px" : "34px";
        ringRef.current.style.borderColor = label ? "#d63b25" : "rgba(241,231,214,0.55)";
        ringRef.current.style.backgroundColor = label ? "rgba(214,59,37,0.12)" : "transparent";
      }
      if (labelRef.current) {
        labelRef.current.textContent = label ?? "";
        labelRef.current.style.opacity = label ? "1" : "0";
      }
    };
    loop();
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [worldState]);

  return (
    <div className="cursor-ui pointer-events-none fixed inset-0 z-[95]" aria-hidden="true">
      <div
        ref={ringRef}
        className="cursor-ring absolute -ml-[17px] -mt-[17px] flex items-center justify-center rounded-full border"
        style={{ width: 34, height: 34, left: 0, top: 0, opacity: 0, borderColor: "rgba(241,231,214,0.55)" }}
      >
        <span ref={labelRef} className="font-display text-[11px] tracking-[0.14em] text-cream" style={{ opacity: 0 }} />
      </div>
      <div
        ref={dotRef}
        className="absolute -ml-[3px] -mt-[3px] h-[6px] w-[6px] rounded-full bg-tomato"
        style={{ left: 0, top: 0, opacity: 0 }}
      />
    </div>
  );
}
