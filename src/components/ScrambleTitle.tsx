import { useEffect, useRef, useState } from "react";

const GLYPHS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789#%*+=-/<>";

/** Board-style decode of a title: plays when it first scrolls into view, whenever `replay` changes,
 *  on mouse hover over its heading, and at random 15–30 s intervals while visible on an active tab. */
export function ScrambleTitle({ text, replay }: { text: string; replay?: unknown }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cells, setCells] = useState<{ ch: string; done: boolean }[] | null>(null);
  const [run, setRun] = useState(0);
  const seen = useRef(false);
  const visible = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      visible.current = !!e?.isIntersecting;
      if (visible.current && !seen.current) {
        seen.current = true;
        setRun((r) => r + 1);
      }
    }, { threshold: 0.2 });
    io.observe(el);
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (visible.current && document.visibilityState === "visible") setRun((r) => r + 1);
        schedule();
      }, 15000 + Math.random() * 15000);
    };
    schedule();
    const host = el.closest("button, h2") ?? el;
    let lastHover = 0;
    const onEnter = (ev: Event) => {
      if ((ev as PointerEvent).pointerType !== "mouse") return;
      const now = performance.now();
      if (now - lastHover < 1200) return;
      lastHover = now;
      setRun((r) => r + 1);
    };
    host.addEventListener("pointerenter", onEnter);
    return () => { io.disconnect(); clearTimeout(timer); host.removeEventListener("pointerenter", onEnter); };
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setRun((r) => r + 1);
  }, [replay]);

  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...text];
    const lock = chars.map((_, i) => i * 35 + Math.random() * 180);
    const start = performance.now();
    let raf = 0, last = 0;
    const tick = (now: number) => {
      const t = now - start;
      if (now - last >= 50 || t >= (Math.max(...lock) )) {
        last = now;
        setCells(chars.map((c, i) => c === " " || t >= (lock[i] ?? 0)
          ? { ch: c, done: true }
          : { ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? c, done: false }));
      }
      if (t < Math.max(...lock)) raf = requestAnimationFrame(tick);
      else setCells(null);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setCells(null); };
  }, [run, text]);

  return (
    <span ref={ref} className="min-w-0 truncate" aria-label={text}>
      {cells ? cells.map((c, i) => <span key={i} aria-hidden="true" className={c.done ? "" : "text-muted-foreground"}>{c.ch}</span>) : text}
    </span>
  );
}
