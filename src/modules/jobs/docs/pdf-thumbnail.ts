import { PDF_THUMBNAIL_WIDTH } from "../files";

/**
 * The first page of a PDF as a WebP, drawn in the browser at upload — the
 * same place a photo's gallery copy is made, so the grid shows a plan's cover
 * sheet without the server ever opening a PDF.
 *
 * pdf.js is loaded here and nowhere else, so only somebody uploading a PDF
 * pays for it. Its worker is bundled with the app rather than fetched from a
 * CDN. A PDF that can't be drawn — encrypted, damaged — returns null and goes
 * up without a picture: the preview is a courtesy, never a reason to refuse
 * the file.
 */
export async function pdfThumbnail(file: Blob): Promise<Blob | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
        type: "module",
      });
    }

    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: PDF_THUMBNAIL_WIDTH / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      // A long strip (a roll of drawings) is cut at a portrait page's height: the tile shows the top anyway.
      canvas.height = Math.min(Math.round(viewport.height), Math.round(viewport.width * 1.5));
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    } finally {
      await task.destroy();
    }
  } catch {
    return null;
  }
}
