import { useEffect, useRef, useState } from "react";

const GLYPHS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789#%*+=-/<>";

/** Board-style decode of a title: plays once when it first scrolls into view and again whenever `replay` changes. */
export function ScrambleTitle({ text, replay }: { text: string; replay?: unknown }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cells, setCells] = useState<{ ch: string; done: boolean }[] | null>(null);
  const [run, setRun] = useState(0);
  const seen = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting) && !seen.current) {
        seen.current = true;
        setRun((r) => r + 1);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
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
