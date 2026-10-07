import { PDFDocument, PDFName, PDFArray, PDFDict, degrees } from "pdf-lib";

export const MAX_BYTES = 40 * 1024 * 1024;
export const MAX_PAGES = 160;
const mm = (n: number) => (n * 72) / 25.4;
export const PAPERS = {
  A4: { width: mm(297), height: mm(210), label: "297 × 210 mm" },
  A3: { width: mm(420), height: mm(297), label: "420 × 297 mm" },
  Letter: { width: 792, height: 612, label: "11 × 8.5 in" },
} as const;
export type Paper = keyof typeof PAPERS;
export type Binding = "left" | "right";
export type Pair = [number | null, number | null];
export interface Sheet {
  front: Pair;
  back: Pair;
}
export interface Settings {
  paper: Paper;
  binding: Binding;
  marginMm: number;
}

/** Page numbers are one-based; null is an intentionally blank padded page. */
export function orderBooklet(
  pageCount: number,
  binding: Binding = "left",
): Sheet[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PAGES) {
    throw new Error(`頁數須介於 1 與 ${MAX_PAGES} 頁。`);
  }
  if (binding !== "left" && binding !== "right")
    throw new Error("不支援的裝訂方向。");
  const total = Math.ceil(pageCount / 4) * 4;
  const actual = (n: number) => (n > pageCount ? null : n);
  const pair = (a: number, b: number): Pair =>
    binding === "left" ? [actual(a), actual(b)] : [actual(b), actual(a)];
  return Array.from({ length: total / 4 }, (_, i) => ({
    front: pair(total - 2 * i, 1 + 2 * i),
    back: pair(2 + 2 * i, total - 1 - 2 * i),
  }));
}

export async function loadSource(bytes: Uint8Array): Promise<PDFDocument> {
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("這份檔案超過 40 MB。請先縮小 PDF 再試一次。");
  if (
    bytes.byteLength < 5 ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  ) {
    throw new Error("這不是可讀取的 PDF，請選擇 .pdf 檔案。");
  }
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new Error("目前無法處理加密或密碼保護的 PDF，請先匯出未加密版本。");
    }
    throw new Error("無法開啟這份 PDF，檔案可能已損毀。");
  }
  orderBooklet(source.getPageCount());
  if (source.getForm().hasXFA() || source.getForm().getFields().length)
    throw new Error("請先將表單欄位壓平，再匯入 PDF。");
  for (const [index, page] of source.getPages().entries()) {
    if (
      !Number.isFinite(page.getRotation().angle) ||
      page.getRotation().angle % 90 !== 0
    ) {
      throw new Error(`第 ${index + 1} 頁的旋轉角度不受支援。`);
    }
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annots) {
      for (let j = 0; j < annots.size(); j++) {
        const annotation = annots.lookup(j, PDFDict);
        if (annotation.get(PDFName.of("Subtype"))?.toString() !== "/Link") {
          throw new Error(`第 ${index + 1} 頁含註解，請先壓平 PDF 再匯入。`);
        }
      }
    }
    const { x, y, width, height } = page.getCropBox();
    const media = page.getMediaBox();
    if (
      ![x, y, width, height, media.x, media.y, media.width, media.height].every(
        Number.isFinite,
      ) ||
      width <= 0 ||
      height <= 0 ||
      width > 14400 ||
      height > 14400 ||
      x < media.x ||
      y < media.y ||
      x + width > media.x + media.width + 0.01 ||
      y + height > media.y + media.height + 0.01
    ) {
      throw new Error(
        `第 ${index + 1} 頁的裁切範圍不受支援。請先重新匯出 PDF。`,
      );
    }
    if (page.node.get(PDFName.of("UserUnit"))) {
      throw new Error(`第 ${index + 1} 頁使用自訂單位，請先重新匯出標準 PDF。`);
    }
  }
  return source;
}

export async function impose(
  source: PDFDocument,
  settings: Settings,
): Promise<Uint8Array> {
  const paper = PAPERS[settings.paper];
  if (!paper) throw new Error("不支援的紙張尺寸。");
  if (
    !Number.isFinite(settings.marginMm) ||
    settings.marginMm < 0 ||
    settings.marginMm > 20
  ) {
    throw new Error("留白須介於 0 與 20 mm。");
  }
  const sheets = orderBooklet(source.getPageCount(), settings.binding);
  const output = await PDFDocument.create();
  output.setTitle("Booklet");
  const embedded = await Promise.all(
    source.getPages().map((page) => {
      if (!page.node.Contents()) return null;
      const box = page.getCropBox();
      return output.embedPage(page, {
        left: box.x,
        bottom: box.y,
        right: box.x + box.width,
        top: box.y + box.height,
      });
    }),
  );
  const margin = mm(settings.marginMm);
  const slotWidth = paper.width / 2;
  for (const sheet of sheets) {
    for (const pair of [sheet.front, sheet.back]) {
      const side = output.addPage([paper.width, paper.height]);
      for (let slot = 0; slot < pair.length; slot++) {
        const number = pair[slot];
        if (number === null) continue;
        const page = embedded[number - 1];
        if (!page) continue;
        const rotation =
          ((source.getPage(number - 1).getRotation().angle % 360) + 360) % 360;
        const displayWidth = rotation % 180 === 0 ? page.width : page.height;
        const displayHeight = rotation % 180 === 0 ? page.height : page.width;
        const scale = Math.min(
          (slotWidth - 2 * margin) / displayWidth,
          (paper.height - 2 * margin) / displayHeight,
        );
        const x = slot * slotWidth + (slotWidth - displayWidth * scale) / 2;
        const y = (paper.height - displayHeight * scale) / 2;
        // PDF /Rotate is clockwise; content drawing rotations are counterclockwise.
        const offsetX =
          rotation === 180 || rotation === 270 ? displayWidth * scale : 0;
        const offsetY =
          rotation === 90 || rotation === 180 ? displayHeight * scale : 0;
        side.drawPage(page, {
          x: x + offsetX,
          y: y + offsetY,
          width: page.width * scale,
          height: page.height * scale,
          rotate: degrees(-rotation),
        });
      }
    }
  }
  return output.save();
}
