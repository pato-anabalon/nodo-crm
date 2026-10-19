import { ImageResponse } from "next/og";
import { MARK_SIZE, markSvg, svgDataUri } from "@/modules/marketing/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home-screen icon. iOS rounds the corners itself and wants the square
 * filled, so the mark is drawn at a whole 5× — 160px, crisp — over its own sky.
 */
export default function AppleIcon() {
  const scale = 5;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#2a7fe2" }}>
      <img src={svgDataUri(markSvg())} width={MARK_SIZE * scale} height={MARK_SIZE * scale} alt="" />
    </div>,
    size,
  );
}
