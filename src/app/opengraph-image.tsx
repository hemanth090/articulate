import { ImageResponse } from "next/og";

export const alt = "Articulate · Read research, beautifully";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The 5x5 pixel-A from icon.svg, as a bitmap (1 = filled). */
const GLYPH = [
  0, 1, 1, 1, 0,
  1, 0, 0, 0, 1,
  1, 1, 1, 1, 1,
  1, 0, 0, 0, 1,
  1, 0, 0, 0, 1,
];

export default function OpengraphImage() {
  const cell = 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#ffffff",
          padding: 32,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid #0a0a0a",
            padding: "40px 56px",
          }}
        >
          {/* top kicker row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              letterSpacing: 5,
              color: "#737373",
            }}
          >
            <span>ARXIV · JEV · GROQ</span>
            <span>§00</span>
          </div>

          {/* hero: pixel A + wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                width: cell * 5,
                height: cell * 5,
                flexShrink: 0,
              }}
            >
              {GLYPH.map((filled, i) => (
                <div
                  key={i}
                  style={{
                    width: cell,
                    height: cell,
                    backgroundColor: filled ? "#0a0a0a" : "transparent",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 84, fontWeight: 700, color: "#0a0a0a", lineHeight: 1 }}>
                Articulate
              </div>
              <div style={{ fontSize: 30, color: "#525252", lineHeight: 1.35, maxWidth: 560 }}>
                Search arXiv. Read research, beautifully.
              </div>
            </div>
          </div>

          {/* bottom pipeline caption */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 20,
              letterSpacing: 3,
              color: "#737373",
            }}
          >
            <span>TOP 20 · RANKED · PLAIN-ENGLISH SUMMARIES</span>
            <span style={{ color: "#0a0a0a" }}>FREE · NO SIGNUP</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
