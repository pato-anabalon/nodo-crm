import { ImageResponse } from "next/og";
import { MARK_SIZE, markSvg, svgDataUri } from "@/modules/marketing/brand-mark";

export const size = { width: MARK_SIZE, height: MARK_SIZE };
export const contentType = "image/png";

/** The tab's icon: the pixel Sky Tower, one pixel of the drawing to one of the image. */
export default function Icon() {
  return new ImageResponse(
    <img src={svgDataUri(markSvg())} width={MARK_SIZE} height={MARK_SIZE} alt="" />,
    size,
  );
}
