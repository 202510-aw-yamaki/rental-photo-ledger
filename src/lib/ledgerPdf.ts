import fontkit from "@pdf-lib/fontkit";
import notoSansJpUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2?url";
import { PDFDocument, PDFPage, rgb, type PDFFont } from "pdf-lib";
import { APP_NAME, PDF_NOTICE } from "../constants";
import type { FloorPlan, FloorPlanPin, PhotoRecord, Property } from "../types";

export type LedgerPdfInput = {
  property: Property;
  floorPlan: FloorPlan | null;
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
};

const pageSize: [number, number] = [595.28, 841.89];
const ink = rgb(0.09, 0.13, 0.12);
const muted = rgb(0.36, 0.44, 0.42);
const line = rgb(0.82, 0.88, 0.86);
const primary = rgb(0.06, 0.46, 0.43);
const accent = rgb(0.15, 0.39, 0.92);

export function sanitizeFileName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[\x00-\x1f]+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\.+/, "")
    .replace(/\.+$/g, (match) => "_".repeat(match.length))
    .slice(0, 120);

  return cleaned || "未指定";
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

export function buildLedgerFileName(propertyName: string, exportedAt = new Date()): string {
  const stamp = formatDateTime(exportedAt).replace(/[-: ]/g, "");
  return `${sanitizeFileName(propertyName)}_写真台帳_${stamp}.pdf`;
}

export async function generateLedgerPdf(input: LedgerPdfInput): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await loadJapaneseFont(pdfDoc);

  addCoverPage(pdfDoc, font, input.property);
  await addFloorPlanPage(pdfDoc, font, input.floorPlan, input.pins);
  await addPhotoPages(pdfDoc, font, input.pins, input.photos);

  const bytes = await pdfDoc.save();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

async function loadJapaneseFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const response = await fetch(notoSansJpUrl);
  const bytes = await response.arrayBuffer();
  return pdfDoc.embedFont(bytes, { subset: true });
}

function addCoverPage(pdfDoc: PDFDocument, font: PDFFont, property: Property) {
  const page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: primary });
  page.drawText(APP_NAME, { x: 48, y: height - 78, size: 24, font, color: rgb(1, 1, 1) });
  page.drawText("写真台帳", { x: 48, y: height - 112, size: 16, font, color: rgb(0.88, 1, 0.98) });

  const rows = [
    ["管理用の名前", property.name || "未入力"],
    ["入居日", property.moveInDate || "未入力"],
    ["退去日", property.moveOutDate || "未入力"],
    ["作成日", formatDateTime(new Date())]
  ];

  let y = height - 190;
  rows.forEach(([label, value]) => {
    page.drawText(label, { x: 54, y, size: 10, font, color: muted });
    page.drawText(value, { x: 150, y, size: 12, font, color: ink });
    y -= 30;
  });

  drawWrappedText(page, font, PDF_NOTICE, 54, y - 30, 62, 12, 20, muted);
}

async function addFloorPlanPage(pdfDoc: PDFDocument, font: PDFFont, floorPlan: FloorPlan | null, pins: FloorPlanPin[]) {
  const page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  drawPageTitle(page, font, "間取り図と番号ピン");

  if (!floorPlan) {
    page.drawText("間取りPDFはまだ登録されていません。", { x: 48, y: height - 150, size: 12, font, color: muted });
    return;
  }

  const sourceBytes = await floorPlan.fileBlob.arrayBuffer();
  const [embeddedPage] = await pdfDoc.embedPdf(sourceBytes, [0]);
  const margin = 48;
  const maxWidth = width - margin * 2;
  const maxHeight = height - 170;
  const scale = Math.min(maxWidth / embeddedPage.width, maxHeight / embeddedPage.height);
  const planWidth = embeddedPage.width * scale;
  const planHeight = embeddedPage.height * scale;
  const planX = (width - planWidth) / 2;
  const planY = 70;

  page.drawPage(embeddedPage, { x: planX, y: planY, width: planWidth, height: planHeight });
  page.drawRectangle({ x: planX, y: planY, width: planWidth, height: planHeight, borderColor: line, borderWidth: 1 });

  pins.forEach((pin) => {
    const x = planX + pin.x * planWidth;
    const y = planY + (1 - pin.y) * planHeight;
    drawPin(page, font, pin.label, x, y, 11);
  });
}

async function addPhotoPages(pdfDoc: PDFDocument, font: PDFFont, pins: FloorPlanPin[], photos: PhotoRecord[]) {
  const photosByPin = new Map(pins.map((pin) => [pin.id, pin]));
  const sortedPhotos = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  let page: PDFPage | null = null;
  let slot = 0;

  if (sortedPhotos.length === 0) {
    page = pdfDoc.addPage(pageSize);
    drawPageTitle(page, font, "写真台帳");
    page.drawText("写真はまだ登録されていません。", { x: 48, y: page.getHeight() - 150, size: 12, font, color: muted });
    return;
  }

  for (const photo of sortedPhotos) {
    if (!page || slot >= 2) {
      page = pdfDoc.addPage(pageSize);
      drawPageTitle(page, font, "写真台帳");
      slot = 0;
    }

    const yTop = slot === 0 ? page.getHeight() - 135 : page.getHeight() / 2 - 40;
    await drawPhotoRecord(pdfDoc, page, font, photo, photosByPin.get(photo.pinId), yTop);
    slot += 1;
  }
}

async function drawPhotoRecord(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  photo: PhotoRecord,
  pin: FloorPlanPin | undefined,
  yTop: number
) {
  const imageBytes = await photo.imageBlob.arrayBuffer();
  const image = await pdfDoc.embedJpg(imageBytes).catch(() => pdfDoc.embedPng(imageBytes));
  const imageBox = { x: 48, y: yTop - 190, width: 190, height: 150 };
  const scale = Math.min(imageBox.width / image.width, imageBox.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  page.drawRectangle({ ...imageBox, borderColor: line, borderWidth: 1 });
  page.drawImage(image, {
    x: imageBox.x + (imageBox.width - drawWidth) / 2,
    y: imageBox.y + (imageBox.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  });

  const label = pin ? `ピン ${pin.label}` : "ピン未選択";
  page.drawText(label, { x: 260, y: yTop - 20, size: 13, font, color: primary });
  page.drawText(`場所名: ${pin?.placeName || "未入力"}`, { x: 260, y: yTop - 48, size: 10, font, color: ink });
  page.drawText(`カテゴリー: ${photo.category}`, { x: 260, y: yTop - 72, size: 10, font, color: ink });
  page.drawText(`登録日時: ${formatDateTime(photo.takenAt)}`, { x: 260, y: yTop - 96, size: 10, font, color: muted });
  drawWrappedText(page, font, `コメント: ${photo.comment || "未入力"}`, 260, yTop - 126, 32, 10, 17, ink);
}

function drawPageTitle(page: PDFPage, font: PDFFont, title: string) {
  const { width, height } = page.getSize();
  page.drawText(title, { x: 48, y: height - 58, size: 18, font, color: ink });
  page.drawLine({ start: { x: 48, y: height - 76 }, end: { x: width - 48, y: height - 76 }, thickness: 1, color: line });
}

function drawPin(page: PDFPage, font: PDFFont, label: string, x: number, y: number, radius: number) {
  page.drawCircle({ x, y, size: radius, color: accent });
  page.drawText(label, {
    x: x - label.length * 3,
    y: y - 4,
    size: 9,
    font,
    color: rgb(1, 1, 1)
  });
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxChars: number,
  size: number,
  lineHeight: number,
  color = ink
) {
  const lines = wrapByCharCount(text, maxChars);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
}

function wrapByCharCount(text: string, maxChars: number): string[] {
  const source = text.replace(/\r?\n/g, " ");
  const lines: string[] = [];
  for (let index = 0; index < source.length; index += maxChars) {
    lines.push(source.slice(index, index + maxChars));
  }
  return lines.length > 0 ? lines : [""];
}
