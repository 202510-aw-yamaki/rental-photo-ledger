import fontkit from "@pdf-lib/fontkit";
import notoSansJpUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-0-400-normal.woff?url";
import { PDFDocument, PDFPage, rgb, type PDFFont } from "pdf-lib";

export type SampleLayoutType = "oneRoom" | "oneK" | "twoLdk";

export type SamplePinSeed = {
  label: string;
  placeName: string;
  x: number;
  y: number;
};

type RoomFill = "room" | "wet" | "kitchen" | "storage" | "outside" | "hall";

type RoomShape = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: RoomFill;
};

export type SampleLayoutDefinition = {
  type: SampleLayoutType;
  title: string;
  propertyName: string;
  description: string;
  fileName: string;
  rooms: RoomShape[];
  pins: SamplePinSeed[];
};

const pageSize = { width: 595.28, height: 841.89 };
const planBox = { x: 60, y: 92, width: 475, height: 690 };
const ink = rgb(0.09, 0.13, 0.12);
const muted = rgb(0.36, 0.44, 0.42);
const line = rgb(0.28, 0.35, 0.33);
const accent = rgb(0.15, 0.39, 0.92);

export const SAMPLE_LAYOUTS: SampleLayoutDefinition[] = [
  {
    type: "oneRoom",
    title: "ワンルーム",
    propertyName: "サンプル ワンルーム",
    description: "玄関から室内までが一体になった、単身向けの一般的な構成です。",
    fileName: "sample-one-room.pdf",
    rooms: [
      room("玄関", 0.08, 0.04, 0.22, 0.11, "hall"),
      room("キッチン", 0.3, 0.04, 0.34, 0.16, "kitchen"),
      room("浴室", 0.64, 0.04, 0.28, 0.16, "wet"),
      room("収納", 0.08, 0.2, 0.2, 0.17, "storage"),
      room("洋室 8帖", 0.28, 0.2, 0.64, 0.56, "room"),
      room("ベランダ", 0.28, 0.76, 0.64, 0.13, "outside")
    ],
    pins: [
      pin("1", "玄関", 0.19, 0.095),
      pin("2", "キッチン", 0.47, 0.12),
      pin("3", "浴室", 0.78, 0.12),
      pin("4", "洋室", 0.6, 0.48),
      pin("5", "収納", 0.18, 0.285),
      pin("6", "ベランダ", 0.6, 0.825)
    ]
  },
  {
    type: "oneK",
    title: "1K",
    propertyName: "サンプル 1K",
    description: "キッチンと居室が扉で分かれた、1Kの一般的な構成です。",
    fileName: "sample-1k.pdf",
    rooms: [
      room("玄関", 0.08, 0.04, 0.2, 0.11, "hall"),
      room("キッチン", 0.28, 0.04, 0.36, 0.2, "kitchen"),
      room("トイレ", 0.64, 0.04, 0.14, 0.2, "wet"),
      room("浴室", 0.78, 0.04, 0.14, 0.2, "wet"),
      room("廊下", 0.08, 0.15, 0.2, 0.28, "hall"),
      room("収納", 0.08, 0.43, 0.18, 0.18, "storage"),
      room("洋室 7帖", 0.26, 0.26, 0.66, 0.5, "room"),
      room("ベランダ", 0.26, 0.76, 0.66, 0.13, "outside")
    ],
    pins: [
      pin("1", "玄関", 0.18, 0.095),
      pin("2", "キッチン", 0.46, 0.14),
      pin("3", "トイレ", 0.71, 0.14),
      pin("4", "浴室", 0.85, 0.14),
      pin("5", "洋室", 0.59, 0.51),
      pin("6", "収納", 0.17, 0.52),
      pin("7", "ベランダ", 0.59, 0.825)
    ]
  },
  {
    type: "twoLdk",
    title: "2LDK",
    propertyName: "サンプル 2LDK",
    description: "LDKと2つの居室、水回りを含むファミリー向けの一般的な構成です。",
    fileName: "sample-2ldk.pdf",
    rooms: [
      room("玄関", 0.08, 0.04, 0.18, 0.11, "hall"),
      room("廊下", 0.26, 0.04, 0.2, 0.34, "hall"),
      room("トイレ", 0.46, 0.04, 0.15, 0.16, "wet"),
      room("洗面", 0.61, 0.04, 0.17, 0.16, "wet"),
      room("浴室", 0.78, 0.04, 0.14, 0.16, "wet"),
      room("洋室 5帖", 0.08, 0.2, 0.31, 0.25, "room"),
      room("洋室 6帖", 0.61, 0.23, 0.31, 0.25, "room"),
      room("収納", 0.39, 0.38, 0.14, 0.18, "storage"),
      room("LDK 12帖", 0.08, 0.48, 0.84, 0.29, "room"),
      room("キッチン", 0.08, 0.48, 0.3, 0.14, "kitchen"),
      room("ベランダ", 0.08, 0.77, 0.84, 0.12, "outside")
    ],
    pins: [
      pin("1", "玄関", 0.17, 0.095),
      pin("2", "トイレ", 0.535, 0.12),
      pin("3", "洗面", 0.695, 0.12),
      pin("4", "浴室", 0.85, 0.12),
      pin("5", "洋室 5帖", 0.235, 0.325),
      pin("6", "洋室 6帖", 0.765, 0.355),
      pin("7", "LDK", 0.58, 0.635),
      pin("8", "キッチン", 0.23, 0.55),
      pin("9", "収納", 0.46, 0.47),
      pin("10", "ベランダ", 0.5, 0.83)
    ]
  }
];

export function getSampleLayout(type: SampleLayoutType): SampleLayoutDefinition {
  return SAMPLE_LAYOUTS.find((layout) => layout.type === type) ?? SAMPLE_LAYOUTS[0];
}

export async function generateSampleLayoutPdf(type: SampleLayoutType): Promise<Blob> {
  const layout = getSampleLayout(type);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await loadJapaneseFont(pdfDoc);
  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);

  drawHeader(page, font, layout);
  drawPlanFrame(page);
  layout.rooms.forEach((shape) => drawRoom(page, font, shape));
  layout.pins.forEach((seed) => drawPin(page, font, seed));
  drawLegend(page, font);

  const bytes = await pdfDoc.save();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

function room(label: string, x: number, y: number, width: number, height: number, fill: RoomFill): RoomShape {
  return { label, x, y, width, height, fill };
}

function pin(label: string, placeName: string, x: number, y: number): SamplePinSeed {
  return {
    label,
    placeName,
    x: (planBox.x + x * planBox.width) / pageSize.width,
    y: (planBox.y + y * planBox.height) / pageSize.height
  };
}

async function loadJapaneseFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const response = await fetch(notoSansJpUrl);
  const bytes = await response.arrayBuffer();
  return pdfDoc.embedFont(bytes);
}

function drawHeader(page: PDFPage, font: PDFFont, layout: SampleLayoutDefinition) {
  page.drawText(`サンプル間取り: ${layout.title}`, { x: 52, y: pageSize.height - 48, size: 18, font, color: ink });
  page.drawText(layout.description, { x: 52, y: pageSize.height - 72, size: 9, font, color: muted });
}

function drawPlanFrame(page: PDFPage) {
  page.drawRectangle({
    x: planBox.x,
    y: pageSize.height - planBox.y - planBox.height,
    width: planBox.width,
    height: planBox.height,
    borderColor: line,
    borderWidth: 2,
    color: rgb(1, 1, 1)
  });
}

function drawRoom(page: PDFPage, font: PDFFont, shape: RoomShape) {
  const rect = toPdfRect(shape);
  page.drawRectangle({
    ...rect,
    color: fillColor(shape.fill),
    borderColor: line,
    borderWidth: 1.5
  });
  page.drawText(shape.label, {
    x: rect.x + 8,
    y: rect.y + rect.height / 2 - 5,
    size: 10,
    font,
    color: ink
  });
}

function drawPin(page: PDFPage, font: PDFFont, seed: SamplePinSeed) {
  const x = seed.x * pageSize.width;
  const y = pageSize.height - seed.y * pageSize.height;
  page.drawCircle({ x, y, size: 10, color: accent });
  page.drawText(seed.label, {
    x: x - seed.label.length * 3,
    y: y - 4,
    size: 8,
    font,
    color: rgb(1, 1, 1)
  });
}

function drawLegend(page: PDFPage, font: PDFFont) {
  page.drawText("この間取りはサンプルです。実際の物件に合わせてPDFを差し替え、番号ピンを調整できます。", {
    x: 52,
    y: 36,
    size: 8,
    font,
    color: muted
  });
}

function toPdfRect(shape: RoomShape) {
  const x = planBox.x + shape.x * planBox.width;
  const yTop = planBox.y + shape.y * planBox.height;
  const width = shape.width * planBox.width;
  const height = shape.height * planBox.height;

  return {
    x,
    y: pageSize.height - yTop - height,
    width,
    height
  };
}

function fillColor(fill: RoomFill) {
  switch (fill) {
    case "wet":
      return rgb(0.89, 0.95, 1);
    case "kitchen":
      return rgb(0.93, 0.96, 0.9);
    case "storage":
      return rgb(0.95, 0.93, 0.88);
    case "outside":
      return rgb(0.9, 0.96, 0.95);
    case "hall":
      return rgb(0.95, 0.96, 0.97);
    default:
      return rgb(0.99, 0.98, 0.94);
  }
}
