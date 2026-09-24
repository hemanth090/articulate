import { useMemo } from "react";


/**
 * Classic pixelated / line-art decorative elements. Pure SVG, no animation.
 */

/** 5×5 pixel "A" mark. */
export function PixelMark({ className = "" }: { className?: string }) {
  const cells = [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ];
  return (
    <svg
      viewBox="0 0 5 5"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {cells.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/** Deterministic dotted strip used as a quiet divider. */
export function PixelStrip({ count = 48, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const on = (i * 7 + 3) % 5 < 2;
        return (
          <span
            key={i}
            className={`block size-[3px] ${on ? "bg-neutral-950" : "bg-neutral-300"}`}
          />
        );
      })}
    </div>
  );
}

/** Corner crosshair, line-art style. */
export function Crosshair({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 0v16M0 8h16" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="6" width="4" height="4" fill="currentColor" />
    </svg>
  );
}

/**
 * Deterministic 5×5 identicon-style glyph, horizontally mirrored from a
 * string seed. Used to give curated topics distinct pixel icons without
 * shipping any assets.
 */
export function PixelGlyph({
  seed,
  size = 20,
  density = 0.5,
  variant = "A",
  className = "",
}: {
  seed: string;
  /** Pixel size of the rendered square (the glyph is always 5×5 cells). */
  size?: number;
  /** Rough fraction of the 15 unique cells that light up (0–1). */
  density?: number;
  /** Rotates the hash so seeds can share a palette of shapes. */
  variant?: "A" | "B" | "C";
  className?: string;
}) {
  let h = 2166136261 ^ variant.charCodeAt(0);
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) + 12345;
    cells.push(((h >>> 16) & 0xff) / 255 < density);
  }
  return (
    <svg
      viewBox="0 0 5 5"
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {Array.from({ length: 5 }, (_, y) =>
        Array.from({ length: 5 }, (_, x) => {
          const mx = x < 3 ? x : 4 - x;
          return cells[y * 3 + mx] ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill="currentColor"
              className="glyph-cell"
              style={{ animationDelay: `${(y * 5 + x) * 14}ms` }}
            />
          ) : null;
        }),
      )}
    </svg>
  );
}


/* ------------------------------------------------------------------ */

type Star = {
  x: number;
  y: number;
  size: number;
  tone: string;
  delay: string;
  dur: string;
};

/**
 * The hero's big moving object: a two-arm spiral galaxy drawn in pixels.
 * Stars are placed once (deterministic PRNG) on a logarithmic spiral with
 * Gaussian arm scatter, snapped to a 2px grid. Motion is pure CSS: three
 * radial bands rotate at different speeds (differential rotation, like the
 * real thing) and each star twinkles on its own phase.
 */
export function PixelGalaxy({
  size = 400,
  stars = 650,
  className = "",
}: {
  size?: number;
  stars?: number;
  className?: string;
}) {
  const bands = useMemo(() => {
    let h = 0x9e3779b9; // golden-ratio seed: same sky on every load
    const rand = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822519);
      h = Math.imul(h ^ (h >>> 13), 3266489917);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
    const inner: Star[] = [];
    const mid: Star[] = [];
    const outer: Star[] = [];
    for (let i = 0; i < stars; i++) {
      const arm = i % 2;
      const t = Math.pow(rand(), 0.62); // radial position, dense core
      const scatter = (rand() + rand() + rand() - 1.5) * 0.42 * (0.25 + t);
      const angle = arm * Math.PI + t * 4.6 + scatter;
      const r = 10 + t * 182 + (rand() - 0.5) * 9;
      const x = Math.round((200 + Math.cos(angle) * r) / 2) * 2;
      const y = Math.round((200 + Math.sin(angle) * r * 0.94) / 2) * 2;
      const star: Star = {
        x,
        y,
        size: t < 0.12 ? 3 : rand() < 0.22 ? 2.5 : 2,
        tone: rand() < 0.14 ? "text-neutral-300" : "text-neutral-950",
        delay: `${(rand() * 6).toFixed(2)}s`,
        dur: `${(2.5 + rand() * 4.5).toFixed(2)}s`,
      };
      if (t < 0.34) inner.push(star);
      else if (t < 0.67) mid.push(star);
      else outer.push(star);
    }
    const field: Star[] = Array.from({ length: 70 }, () => ({
      x: Math.round(rand() * 200) * 2,
      y: Math.round(rand() * 200) * 2,
      size: 1.5,
      tone: "text-neutral-200",
      delay: "0s",
      dur: "5s",
    }));
    return { inner, mid, outer, field };
  }, [stars]);

  const renderStars = (list: Star[], key: string) =>
    list.map((st, i) => (
      <rect
        key={`${key}-${i}`}
        x={st.x}
        y={st.y}
        width={st.size}
        height={st.size}
        fill="currentColor"
        className={`galaxy-star ${st.tone}`}
        style={{ animationDelay: st.delay, animationDuration: st.dur }}
      />
    ));

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g className="galaxy-drift">{renderStars(bands.field, "f")}</g>
      <g transform="rotate(-18 200 200)">
        <g className="galaxy-spin-c">{renderStars(bands.outer, "o")}</g>
        <g className="galaxy-spin-b">{renderStars(bands.mid, "m")}</g>
        <g className="galaxy-spin-a">{renderStars(bands.inner, "i")}</g>
      </g>
      <rect
        x={197}
        y={197}
        width={6}
        height={6}
        fill="currentColor"
        className="galaxy-core text-neutral-950"
      />
      <rect
        x={-24}
        y={80}
        width={16}
        height={2}
        fill="currentColor"
        className="galaxy-meteor text-neutral-950"
      />
    </svg>
  );
}
