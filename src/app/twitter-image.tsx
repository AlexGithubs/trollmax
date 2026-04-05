import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0f 0%, #1a1025 45%, #0f172a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ⚡
          </div>
          <span
            style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: -2,
              color: "#fafafa",
            }}
          >
            TROLLMAX
          </span>
        </div>
        <span style={{ fontSize: 28, color: "#a1a1aa", fontWeight: 500 }}>
          Clone anyone. Troll everyone.
        </span>
      </div>
    ),
    { ...size }
  )
}
