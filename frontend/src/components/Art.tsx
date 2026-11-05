import { useId } from "react";

/** Ethiopian-style processional cross shapes. Original artwork, drawn as simple SVG. */
export function CrossShapes() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M40 12h20v28h28v20H60v28H40V60H12V40h28z" />
      <path d="M46 20h8v26h26v8H54v26h-8V54H20v-8h26z" strokeWidth="1.2" />
      <rect x="42" y="42" width="16" height="16" transform="rotate(45 50 50)" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="3.2" fill="currentColor" stroke="none" />
      <g fill="currentColor" stroke="none">
        <circle cx="50" cy="6" r="4.5" />
        <circle cx="50" cy="94" r="4.5" />
        <circle cx="6" cy="50" r="4.5" />
        <circle cx="94" cy="50" r="4.5" />
        <circle cx="29" cy="29" r="2.4" />
        <circle cx="71" cy="29" r="2.4" />
        <circle cx="29" cy="71" r="2.4" />
        <circle cx="71" cy="71" r="2.4" />
      </g>
    </g>
  );
}

export function CrossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <CrossShapes />
    </svg>
  );
}

const palettes = [
  { top: "#071228", mid: "#27406F", glow: "#E8D08E", ink: "#0A1530" },
  { top: "#2A0C10", mid: "#6B2330", glow: "#E8D08E", ink: "#1A070A" },
  { top: "#0A2229", mid: "#1F5560", glow: "#E8D08E", ink: "#071A20" },
  { top: "#241708", mid: "#6B4A22", glow: "#F0DDA6", ink: "#170F05" },
];

/**
 * Portrait cover art (9:16). Four original scenes:
 * 0 round church at dusk, 1 processional cross, 2 open manuscript, 3 rock-hewn church from above.
 * Phase 6 swaps these for real video thumbnails; the same component stays as the fallback.
 */
export function Cover({ variant = 0, className = "", alt }: { variant?: number; className?: string; alt?: string }) {
  const id = useId().replace(/:/g, "");
  const p = palettes[variant % 4];
  const kind = variant % 4;
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.top} />
          <stop offset="1" stopColor={p.mid} />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill={`url(#g${id})`} />
      {kind === 0 && (
        <g>
          <circle cx="300" cy="190" r="110" fill={`url(#r${id})`} />
          <circle cx="300" cy="190" r="38" fill={p.glow} />
          <path d="M0 470 Q110 400 230 450 T400 420 V600H0Z" fill={p.ink} opacity="0.55" />
          <g transform="translate(160 330)">
            <path d="M-92 40 L0 -92 L92 40Z" fill="#152A52" />
            <path d="M-92 40 L0 -92 L92 40Z" fill="none" stroke={p.glow} strokeWidth="2" />
            <rect x="-72" y="40" width="144" height="110" fill={p.ink} />
            <path d="M-18 150V105a18 18 0 0 1 36 0v45z" fill={p.glow} />
            <path d="M-50 150V118a9 9 0 0 1 18 0v32zM32 150V118a9 9 0 0 1 18 0v32z" fill="#27406F" />
            <g stroke={p.glow} strokeWidth="3" strokeLinecap="round">
              <path d="M0 -92v-34M-9 -113h18" />
            </g>
            <circle cx="0" cy="-130" r="4" fill={p.glow} />
          </g>
          <path d="M0 480 Q200 450 400 485 V600H0Z" fill={p.ink} />
        </g>
      )}
      {kind === 1 && (
        <g style={{ color: p.glow }}>
          <circle cx="200" cy="270" r="210" fill={`url(#r${id})`} />
          <svg x="75" y="145" width="250" height="250" viewBox="0 0 100 100">
            <CrossShapes />
          </svg>
          <path d="M0 520h400M0 540h400" stroke={p.glow} strokeOpacity="0.35" />
        </g>
      )}
      {kind === 2 && (
        <g>
          <circle cx="200" cy="260" r="200" fill={`url(#r${id})`} />
          <path d="M40 220 Q200 190 200 215 Q200 190 360 220 V430 Q200 405 200 430 Q200 405 40 430Z" fill="#FAF4E4" />
          <path d="M200 215V430" stroke="#C9A24B" strokeWidth="2" />
          <rect x="62" y="242" width="46" height="46" fill="#9A3324" />
          <path d="M74 265h22M85 254v22" stroke="#FAF4E4" strokeWidth="3" />
          <g stroke="#0B1B3A" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round">
            <path d="M122 252h58M122 266h58M122 280h40M62 310h118M62 326h118M62 342h118M62 358h90" />
            <path d="M222 252h110M222 268h110M222 284h110M222 310h110M222 326h110M222 342h80" />
            <path d="M222 252h40" stroke="#9A3324" />
          </g>
        </g>
      )}
      {kind === 3 && (
        <g>
          <circle cx="200" cy="300" r="190" fill={`url(#r${id})`} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={50 + i * 22} y={150 + i * 22} width={300 - i * 44} height={300 - i * 44} fill={i % 2 ? p.mid : p.ink} stroke={p.glow} strokeOpacity="0.5" />
          ))}
          <g style={{ color: p.glow }}>
            <svg x="118" y="218" width="164" height="164" viewBox="0 0 100 100">
              <CrossShapes />
            </svg>
          </g>
        </g>
      )}
    </svg>
  );
}
