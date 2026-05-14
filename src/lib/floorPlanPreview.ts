import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { CropRect, FloorPlan, FloorPlanSourceType } from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type SourcePreview = {
  sourceType: FloorPlanSourceType;
  mimeType: string;
  pageCount: number;
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
};

export type CropResult = {
  blob: Blob;
  width: number;
  height: number;
};

const minimumCanvasWidth = 320;
const maximumCanvasWidth = 920;

export function getSourceType(file: File): Exclude<FloorPlanSourceType, "cropped-image"> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (file.type.startsWith("image/")) {
    return "image";
  }
  throw new Error("PDFまたは画像ファイルを選択してください。");
}

export async function renderUploadSource(
  file: File,
  canvas: HTMLCanvasElement,
  targetWidth: number
): Promise<SourcePreview> {
  const sourceType = getSourceType(file);
  if (sourceType === "pdf") {
    return renderPdfBlob(file, canvas, targetWidth, file.type || "application/pdf");
  }
  return renderImageBlob(file, canvas, targetWidth, file.type || "image/png", "image");
}

export async function renderFloorPlan(
  floorPlan: FloorPlan,
  canvas: HTMLCanvasElement,
  targetWidth: number
): Promise<{ width: number; height: number }> {
  const sourceType = floorPlan.sourceType ?? "pdf";
  const mimeType = floorPlan.mimeType || floorPlan.fileBlob.type || "application/pdf";

  if (sourceType === "pdf" || mimeType === "application/pdf") {
    const rendered = await renderPdfBlob(floorPlan.fileBlob, canvas, targetWidth, mimeType);
    return { width: rendered.displayWidth, height: rendered.displayHeight };
  }

  const rendered = await renderImageBlob(floorPlan.fileBlob, canvas, targetWidth, mimeType, sourceType);
  return { width: rendered.displayWidth, height: rendered.displayHeight };
}

export function normalizeCropRect(start: { x: number; y: number }, end: { x: number; y: number }): CropRect {
  const left = clamp01(Math.min(start.x, end.x));
  const top = clamp01(Math.min(start.y, end.y));
  const right = clamp01(Math.max(start.x, end.x));
  const bottom = clamp01(Math.max(start.y, end.y));
  const width = Math.max(0.02, right - left);
  const height = Math.max(0.02, bottom - top);

  return {
    x: Math.min(left, 1 - width),
    y: Math.min(top, 1 - height),
    width,
    height
  };
}

export async function cropCanvasToPngBlob(canvas: HTMLCanvasElement, cropRect: CropRect): Promise<CropResult> {
  const sourceX = Math.round(cropRect.x * canvas.width);
  const sourceY = Math.round(cropRect.y * canvas.height);
  const sourceWidth = Math.max(1, Math.round(cropRect.width * canvas.width));
  const sourceHeight = Math.max(1, Math.round(cropRect.height * canvas.height));
  const output = document.createElement("canvas");

  output.width = sourceWidth;
  output.height = sourceHeight;
  const context = output.getContext("2d");
  if (!context) {
    throw new Error("間取り画像の切り抜きに失敗しました。");
  }

  context.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  const blob = await canvasToBlob(output, "image/png");
  return { blob, width: sourceWidth, height: sourceHeight };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("画像の保存準備に失敗しました。"));
    }, type);
  });
}

async function renderPdfBlob(
  blob: Blob,
  canvas: HTMLCanvasElement,
  targetWidth: number,
  mimeType: string
): Promise<SourcePreview> {
  const document = await loadPdf(blob);
  const page = await document.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const cssWidth = Math.max(minimumCanvasWidth, Math.min(targetWidth || maximumCanvasWidth, maximumCanvasWidth));
  const scale = cssWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const context = prepareCanvas(canvas, viewport.width, viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  const pageCount = document.numPages;
  await document.destroy();

  return {
    sourceType: "pdf",
    mimeType,
    pageCount,
    naturalWidth: baseViewport.width,
    naturalHeight: baseViewport.height,
    displayWidth: viewport.width,
    displayHeight: viewport.height
  };
}

async function renderImageBlob(
  blob: Blob,
  canvas: HTMLCanvasElement,
  targetWidth: number,
  mimeType: string,
  sourceType: FloorPlanSourceType
): Promise<SourcePreview> {
  const image = await loadImage(blob);
  const cssWidth = Math.max(
    minimumCanvasWidth,
    Math.min(targetWidth || image.naturalWidth, maximumCanvasWidth, image.naturalWidth)
  );
  const scale = cssWidth / image.naturalWidth;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const context = prepareCanvas(canvas, width, height);

  context.drawImage(image, 0, 0, width, height);
  return {
    sourceType: sourceType === "pdf" ? "image" : sourceType,
    mimeType,
    pageCount: 1,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    displayWidth: width,
    displayHeight: height
  };
}

function prepareCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("間取りを表示する準備に失敗しました。");
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  return context;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    image.src = url;
  });
}

async function loadPdf(file: Blob) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
