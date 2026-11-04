/**
 * Header mark: an aircraft cabin window (иллюминатор) with its shade pulled
 * down over the top half. The shade's bottom edge sags in a soft curve, the way
 * a real blind does. Behind the glass — a plain sky, two schematic cloud bands
 * and an airliner that drifts slowly past.
 *
 * Deliberately schematic: no sun, no ground, no cast shadow. Colours come from
 * theme tokens (--sky-*, --cloud, --shade-*, --frame).
 */

/** top-down airliner silhouette (nose +x), same family as the map markers */
const DART =
  "M10 0 C10 -0.9 9 -1.4 7.5 -1.4 L3 -1.4 L-1.5 -8.5 L-3.5 -8.5 L-1 -1.4 L-6 -1.3 L-8 -4 L-9.4 -4 L-8.4 0 L-9.4 4 L-8 4 L-6 1.3 L-1 1.4 L-3.5 8.5 L-1.5 8.5 L3 1.4 L7.5 1.4 C9 1.4 10 0.9 10 0 Z";

/** glass box + the shade's bottom edge: 14.8 at the sides, sagging to ~17.9 mid-way */
const GLASS = { x: 5.4, y: 4.4, w: 21.2, h: 31.2 };
const SHADE_SIDE = 14.8;
const SHADE_SAG = 21;
const SHADE_EDGE = `M${GLASS.x} ${SHADE_SIDE} Q16 ${SHADE_SAG} ${GLASS.x + GLASS.w} ${SHADE_SIDE}`;

export function WindowMark({ className = "h-10 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-1)" />
          <stop offset="0.55" stopColor="var(--sky-2)" />
          <stop offset="1" stopColor="var(--sky-3)" />
        </linearGradient>
        {/* contrail: one continuous streak that fades out behind the airliner */}
        <linearGradient id="wm-trail" gradientUnits="userSpaceOnUse" x1="-21" y1="0" x2="-6" y2="0">
          <stop offset="0" stopColor="var(--foreground)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="wm-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shade-2)" />
          <stop offset="0.16" stopColor="var(--shade-1)" />
          <stop offset="0.9" stopColor="var(--shade-1)" />
          <stop offset="1" stopColor="var(--shade-2)" />
        </linearGradient>
        <clipPath id="wm-glass">
          <rect x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} rx="9.4" />
        </clipPath>
      </defs>

      {/* what you can see through the glass */}
      <g clipPath="url(#wm-glass)">
        <rect x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} fill="url(#wm-sky)" />

        {/* one schematic cloud puff, low in the frame */}
        <g fill="var(--cloud)" opacity="0.45">
          <ellipse cx="12" cy="32.6" rx="5.4" ry="2.1" />
          <ellipse cx="14.9" cy="31.1" rx="3.1" ry="1.7" />
        </g>

        <g className="mark-plane">
          <line x1="-21" y1="0" x2="-6" y2="0" stroke="url(#wm-trail)" strokeWidth="1.6" strokeLinecap="round" />
          <g transform="scale(0.46)">
            <path d={DART} fill="var(--foreground)" />
          </g>
        </g>

        {/* the shade: panel with a sagging bottom edge, rigid rail along it, a pull tab */}
        <path d={`M${GLASS.x} ${GLASS.y} H${GLASS.x + GLASS.w} V${SHADE_SIDE} Q16 ${SHADE_SAG} ${GLASS.x} ${SHADE_SIDE} Z`} fill="url(#wm-shade)" />
        <path d={SHADE_EDGE} fill="none" stroke="var(--shade-2)" strokeWidth="2.4" strokeLinecap="round" />
        <path d={SHADE_EDGE} fill="none" stroke="var(--shade-1)" strokeWidth="0.6" opacity="0.5" transform="translate(0 -0.85)" />
        <rect x="14.2" y="18.4" width="3.6" height="1.8" rx="0.9" fill="var(--shade-2)" />

        {/* reflection on the glass, above everything behind it */}
        <path d="M4 30 L18 4 L23 4 L9 33 Z" fill="var(--foreground)" opacity="0.08" />
      </g>

      {/* window frame: plastic rim, dark seam, a soft highlight up top */}
      <rect x="4.2" y="3.2" width="23.6" height="33.6" rx="10.6" fill="none" stroke="var(--background)" strokeOpacity="0.75" strokeWidth="1.2" />
      <rect x="3" y="2" width="26" height="36" rx="11.6" fill="none" stroke="var(--frame)" strokeWidth="2.4" />
      <path d="M5.6 11 C6.6 6.4 10 3.6 14.4 3.3" fill="none" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
