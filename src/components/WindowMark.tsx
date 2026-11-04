/**
 * Header mark: an aircraft cabin window (иллюминатор) with its shade pulled
 * down over the top half. Behind the glass — sky, a low sun, clouds and an
 * airliner that drifts slowly past, so the mark reads as "a window on a flight"
 * rather than a generic plane glyph.
 *
 * Colours come from theme tokens (--sky-*, --shade-*, --frame, --primary).
 */

/** top-down airliner silhouette (nose +x), same family as the map markers */
const DART =
  "M10 0 C10 -0.9 9 -1.4 7.5 -1.4 L3 -1.4 L-1.5 -8.5 L-3.5 -8.5 L-1 -1.4 L-6 -1.3 L-8 -4 L-9.4 -4 L-8.4 0 L-9.4 4 L-8 4 L-6 1.3 L-1 1.4 L-3.5 8.5 L-1.5 8.5 L3 1.4 L7.5 1.4 C9 1.4 10 0.9 10 0 Z";

/** how far the shade hangs: glass runs y 4.4 → 35.6, the rail sits at ~17.6 */
const SHADE_BOTTOM = 17.6;

export function WindowMark({ className = "h-10 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-1)" />
          <stop offset="0.5" stopColor="var(--sky-2)" />
          <stop offset="1" stopColor="var(--sky-3)" />
        </linearGradient>
        <linearGradient id="wm-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="wm-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shade-2)" />
          <stop offset="0.16" stopColor="var(--shade-1)" />
          <stop offset="0.9" stopColor="var(--shade-1)" />
          <stop offset="1" stopColor="var(--shade-2)" />
        </linearGradient>
        <linearGradient id="wm-drop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--background)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--background)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="wm-glass">
          <rect x="5.4" y="4.4" width="21.2" height="31.2" rx="9.4" />
        </clipPath>
      </defs>

      {/* what you can see through the glass */}
      <g clipPath="url(#wm-glass)">
        <rect x="5.4" y="4.4" width="21.2" height="31.2" fill="url(#wm-sky)" />
        <rect x="5.4" y="24" width="21.2" height="11.6" fill="url(#wm-warm)" />
        <g fill="var(--cloud)" opacity="0.85">
          <ellipse cx="10" cy="32.6" rx="6" ry="2.3" />
          <ellipse cx="14.6" cy="31.2" rx="3.6" ry="1.9" />
        </g>
        <g className="mark-plane">
          <line x1="-20" y1="0" x2="-6" y2="0" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
          <g transform="scale(0.46)">
            <path d={DART} fill="var(--foreground)" />
          </g>
        </g>

        {/* the shade: panel, rigid bottom rail with a thumb notch, cast shadow */}
        <rect x="5.4" y="4.4" width="21.2" height={SHADE_BOTTOM - 4.4} fill="url(#wm-shade)" />
        <rect x="4" y={SHADE_BOTTOM - 1.1} width="24" height="2.6" rx="1.3" fill="var(--shade-2)" />
        <rect x="4" y={SHADE_BOTTOM - 0.8} width="24" height="0.8" rx="0.4" fill="var(--shade-1)" opacity="0.45" />
        <rect x="13.9" y={SHADE_BOTTOM - 0.5} width="4.2" height="1.4" rx="0.7" fill="var(--sky-1)" opacity="0.5" />
        <rect x="4" y={SHADE_BOTTOM + 1.3} width="24" height="0.8" fill="var(--background)" opacity="0.4" />
        <rect x="5.4" y={SHADE_BOTTOM + 1.5} width="21.2" height="5" fill="url(#wm-drop)" />

        {/* reflection on the glass, above everything behind it */}
        <path d="M4 30 L18 4 L23 4 L9 33 Z" fill="var(--foreground)" opacity="0.09" />
      </g>

      {/* window frame: plastic rim, dark seam, a soft highlight up top */}
      <rect x="4.2" y="3.2" width="23.6" height="33.6" rx="10.6" fill="none" stroke="var(--background)" strokeOpacity="0.75" strokeWidth="1.2" />
      <rect x="3" y="2" width="26" height="36" rx="11.6" fill="none" stroke="var(--frame)" strokeWidth="2.4" />
      <path d="M5.6 11 C6.6 6.4 10 3.6 14.4 3.3" fill="none" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
