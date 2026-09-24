import React from "react";

/**
 * Minimal Markdown renderer for the summary stream. Supports exactly what the
 * summary prompt produces: "##" headings, "-" bullets, paragraphs, **bold**.
 * Zero dependencies, zero layout shift (monospace metrics not required).
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-neutral-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="my-3 list-none space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3 leading-relaxed text-neutral-700">
            <span className="mt-[9px] block size-[5px] shrink-0 bg-neutral-950" aria-hidden="true" />
            <span>{renderInline(b, `${key}-b${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bullets.push(line.slice(2));
      return;
    }
    flushBullets(`ul-${i}`);
    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={`h-${i}`}
          className="mt-7 mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-950"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={`h-${i}`} className="mt-7 mb-2 text-base font-semibold text-neutral-950">
          {renderInline(line.slice(2), `h-${i}`)}
        </h2>,
      );
    } else if (line.trim() !== "") {
      blocks.push(
        <p key={`p-${i}`} className="my-3 leading-relaxed text-neutral-700">
          {renderInline(line, `p-${i}`)}
        </p>,
      );
    }
  });
  flushBullets("ul-end");

  return <div className="text-[15px]">{blocks}</div>;
}
