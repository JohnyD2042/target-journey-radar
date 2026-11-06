/**
 * «ТАБЛО» wordmark in the style of a retro neon sign: every letter is a hollow
 * outline of a thick stroke with a thin centre line inside it. Built from
 * letter centre-lines and an SVG mask, so it stays sharp and theme-coloured.
 */
const W = 40; // letter width
const STEP = 62;
const T = 15; // top
const B = 55; // bottom

const x = (i: number) => 8 + i * STEP;
const LETTERS = [
  (a: number) => `M${a} ${T}H${a + W}M${a + W / 2} ${T}V${B}`,
  (a: number) => `M${a} ${B}V29Q${a} ${T} ${a + 14} ${T}H${a + 26}Q${a + W} ${T} ${a + W} 29V${B}M${a} 38H${a + W}`,
  (a: number) => `M${a + W} ${T}H${a}V${B}H${a + 27}Q${a + W} ${B} ${a + W} 45Q${a + W} 34 ${a + 27} 34H${a}`,
  (a: number) => `M${a - 2} ${B}H${a + 4}Q${a + 10} ${B} ${a + 10} 47V${T}H${a + W}V${B}`,
  (a: number) => `M${a + 12} ${T}H${a + 28}Q${a + W} ${T} ${a + W} 27V43Q${a + W} ${B} ${a + 28} ${B}H${a + 12}Q${a} ${B} ${a} 43V27Q${a} ${T} ${a + 12} ${T}Z`,
];
const D = LETTERS.map((f, i) => f(x(i))).join("");

export function TabloLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 322 70" className={className} role="img" aria-label="Табло">
      <defs>
        <mask id="tablo-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="322" height="70">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={D} stroke="white" strokeWidth="17" />
            <path d={D} stroke="black" strokeWidth="12" />
            <path d={D} stroke="white" strokeWidth="2.2" />
          </g>
        </mask>
        <filter id="tablo-glow" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#tablo-glow)">
        <rect width="322" height="70" fill="var(--primary)" mask="url(#tablo-mask)" />
      </g>
    </svg>
  );
}
