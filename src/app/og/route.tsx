import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { CLOUDS, H, LAYERS, TRADIE, TRADIE_PATHS, UTE, W, YACHTS } from "@/modules/marketing/auckland-art";
import { svgDataUri } from "@/modules/marketing/brand-mark";

/**
 * The picture a link to the public site unfurls into — on WhatsApp, LinkedIn,
 * Slack, an accelerator's form: the hero's Auckland, drawn by the same
 * painters, with the headline over the sky and the accepted quote over the
 * tradie, who has an arm in the air for it.
 *
 * A route rather than `opengraph-image.tsx`, because that convention reaches
 * every segment under it — a company's own quote link would unfurl into Nodo's
 * pitch. The landing page alone points here (`openGraph.images` in its metadata).
 *
 * Always in British English: a crawler sends no language cookie, and the
 * people a link is shared with are mostly reading English.
 */

const SIZE = { width: 1200, height: 630 };
/** A whole number of image pixels to each pixel of the drawing, so every edge stays sharp. */
const SCALE = 4;
/** The drawing at 4× is 1280 × 720: centred across, and bottom-aligned like the hero, so the ute keeps its wheels. */
const OFFSET = { x: (SIZE.width - W * SCALE) / 2, y: SIZE.height - H * SCALE };

/** Where each drifting cloud and one yacht sit when the picture is still. */
const CLOUD_X = [18, 104, 236, 150];
const YACHT = { index: 0, x: 176, y: 121 };

const pathsOf = (paths: [string, string][]) => paths.map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join("");

function sceneSvg(): string {
  const yacht = YACHTS[YACHT.index];
  const layers = [
    pathsOf(LAYERS.sky),
    ...CLOUDS.map((cloud, index) => `<g transform="translate(${CLOUD_X[index]} ${cloud.y})">${pathsOf(cloud.paths)}</g>`),
    pathsOf(LAYERS.bank),
    pathsOf(LAYERS.ranges),
    pathsOf(LAYERS.rangitoto),
    pathsOf(LAYERS.harbour),
    pathsOf(LAYERS.bridge),
    pathsOf(LAYERS.city),
    `<g transform="translate(${YACHT.x} ${YACHT.y})">${pathsOf(yacht.paths)}</g>`,
    pathsOf(LAYERS.hills),
    pathsOf(LAYERS.foreground),
    `<g transform="translate(${TRADIE.x} ${TRADIE.y})">${pathsOf(TRADIE_PATHS.cheering)}</g>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${layers.join("")}</svg>`;
}

/** Lucide's check-circle, for the notice's tile. */
const CHECK = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#17202b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
);

const font = (file: string) => readFile(path.join(process.cwd(), "src/assets/fonts/geist", file));

export async function GET() {
  const [t, regular, bold] = await Promise.all([
    getTranslations({ locale: "en-GB", namespace: "marketing" }),
    font("Geist-Regular.ttf"),
    font("Geist-Bold.ttf"),
  ]);

  // The notice sits over the tradie's head, as the hero's stack does.
  const notice = { left: OFFSET.x + (TRADIE.x - 7) * SCALE, bottom: SIZE.height - (OFFSET.y + (UTE.ground - UTE.height - 3) * SCALE) };

  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", fontFamily: "Geist", color: "white" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements, not next/image. */}
      <img
        src={svgDataUri(sceneSvg())}
        width={W * SCALE}
        height={H * SCALE}
        alt=""
        style={{ position: "absolute", left: OFFSET.x, top: OFFSET.y }}
      />
      {/* The hero's wash, so the words never sit on a cloud. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 820,
          height: 520,
          backgroundImage: "linear-gradient(to right, rgba(27,116,214,0.92), rgba(31,127,224,0.55) 60%, rgba(31,127,224,0))",
          // Faded out at its foot, as the hero's is, rather than ending in a line across the hills.
          maskImage: "linear-gradient(to bottom, black 70%, transparent)",
        }}
      />

      <div style={{ position: "absolute", left: 64, top: 56, display: "flex", flexDirection: "column", width: 720 }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Nodo CRM</div>
        {/* Narrow enough to break after "Win it.", so the last line is the whole of the third clause. */}
        <div style={{ marginTop: 34, maxWidth: 560, fontSize: 70, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5 }}>
          {t("hero.title")}
        </div>
        <div style={{ marginTop: 22, fontSize: 28, lineHeight: 1.35, color: "rgba(255,255,255,0.92)", maxWidth: 640 }}>
          {t("hero.subtitle")}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: notice.left,
          bottom: notice.bottom,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px 12px 14px",
          background: "#fdfbf4",
          border: "5px solid #17202b",
          boxShadow: "9px 9px 0 0 rgba(23,32,43,0.35)",
          color: "#17202b",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 54,
            height: 54,
            background: "#34d399",
            border: "4px solid #17202b",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements, not next/image. */}
          <img src={CHECK} width={30} height={30} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 18, letterSpacing: 1, textTransform: "uppercase", color: "#4a5566" }}>
            {t("hero.notifications.accepted.label")}
          </div>
          <div style={{ fontSize: 26 }}>{t("hero.notifications.accepted.value")}</div>
        </div>
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
