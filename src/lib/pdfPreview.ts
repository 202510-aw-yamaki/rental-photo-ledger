import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function getPdfPageCount(file: Blob): Promise<number> {
  const document = await loadPdf(file);
  const pageCount = document.numPages;
  await document.destroy();
  return pageCount;
}

export async function renderFirstPdfPage(
  file: Blob,
  canvas: HTMLCanvasElement,
  targetWidth: number
): Promise<{ width: number; height: number; pageCount: number }> {
  const document = await loadPdf(file);
  const page = await document.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const cssWidth = Math.max(280, Math.min(targetWidth, baseViewport.width));
  const scale = cssWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  if (!context) {
    await document.destroy();
    throw new Error("間取りPDFの表示準備に失敗しました。");
  }

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  await document.destroy();

  return {
    width: viewport.width,
    height: viewport.height,
    pageCount: document.numPages
  };
}

async function loadPdf(file: Blob) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}
