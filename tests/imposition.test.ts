import { describe, expect, test } from "vitest";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  impose,
  loadSource,
  MAX_BYTES,
  orderBooklet,
  PAPERS,
  type Paper,
} from "../src/imposition";
import { createSample } from "../src/sample";

async function fixture(count: number, blank = -1) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([300, 400]);
    if (i !== blank)
      page.drawText(`PAGE ${i + 1}`, { x: 30, y: 300, font, size: 30 });
  }
  return pdf;
}
async function readText(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes) });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++)
      pages.push(await (await pdf.getPage(i)).getTextContent());
    return pages;
  } finally {
    await task.destroy();
  }
}

describe("saddle stitch order", () => {
  test("puts outer covers together, then nests inward", () => {
    expect(orderBooklet(12)).toEqual([
      { front: [12, 1], back: [2, 11] },
      { front: [10, 3], back: [4, 9] },
      { front: [8, 5], back: [6, 7] },
    ]);
  });
  test("pads only the missing pages and mirrors each pair for right binding", () => {
    expect(orderBooklet(5)).toEqual([
      { front: [null, 1], back: [2, null] },
      { front: [null, 3], back: [4, 5] },
    ]);
    expect(orderBooklet(5, "right")).toEqual([
      { front: [1, null], back: [null, 2] },
      { front: [3, null], back: [5, 4] },
    ]);
  });
  test("every source page appears exactly once at every supported length", () => {
    for (let n = 1; n <= 160; n++) {
      for (const binding of ["left", "right"] as const) {
        const pages = orderBooklet(n, binding).flatMap((sheet) => [
          ...sheet.front,
          ...sheet.back,
        ]);
        expect(pages.filter((x) => x !== null).sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, i) => i + 1),
        );
        expect(pages.length % 4).toBe(0);
        expect(pages.filter((x) => x === null)).toHaveLength((4 - (n % 4)) % 4);
      }
    }
  });
  test.each([0, -1, 1.5, NaN, Infinity, 161])("rejects invalid count %s", (n) =>
    expect(() => orderBooklet(n)).toThrow(),
  );
});

describe("actual PDF output", () => {
  test.each(Object.keys(PAPERS) as Paper[])(
    "exports correct %s landscape dimensions and four faces for five pages",
    async (paper) => {
      const source = await fixture(5);
      const bytes = await impose(source, {
        paper,
        binding: "left",
        marginMm: 5,
      });
      const output = await PDFDocument.load(bytes);
      expect(output.getPageCount()).toBe(4);
      for (const page of output.getPages()) {
        expect(page.getWidth()).toBeCloseTo(PAPERS[paper].width, 4);
        expect(page.getHeight()).toBeCloseTo(PAPERS[paper].height, 4);
      }
    },
  );
  test("output retains artwork text in correct left/right positions, including blank input page", async () => {
    const source = await loadSource(await (await fixture(5, 2)).save());
    const text = await readText(
      await impose(source, { paper: "A4", binding: "left", marginMm: 5 }),
    );
    const strings = text.map((page) =>
      page.items.filter((item) => "str" in item).map((item) => item.str),
    );
    expect(strings).toEqual([["PAGE 1"], ["PAGE 2"], [], ["PAGE 4", "PAGE 5"]]);
    const first = text[0].items.find(
      (item) => "str" in item && item.str === "PAGE 1",
    );
    expect(first && "transform" in first && first.transform[4]).toBeGreaterThan(
      PAPERS.A4.width / 2,
    );
  });
  test("right-bound output mirrors slots and preserves text", async () => {
    const text = await readText(
      await impose(await fixture(4), {
        paper: "Letter",
        binding: "right",
        marginMm: 0,
      }),
    );
    expect(
      text.map((page) =>
        page.items.filter((item) => "str" in item).map((item) => item.str),
      ),
    ).toEqual([
      ["PAGE 1", "PAGE 4"],
      ["PAGE 3", "PAGE 2"],
    ]);
    const first = text[0].items.find(
      (item) => "str" in item && item.str === "PAGE 1",
    );
    expect(first && "transform" in first && first.transform[4]).toBeLessThan(
      PAPERS.Letter.width / 2,
    );
  });
  test("quarter-turn rotations stay visible inside their allocated half-sheet", async () => {
    const source = await fixture(4);
    [0, 90, 180, 270].forEach((angle, index) =>
      source.getPage(index).setRotation(degrees(angle)),
    );
    const loaded = await loadSource(await source.save());
    const text = await readText(
      await impose(loaded, { paper: "A4", binding: "left", marginMm: 5 }),
    );
    expect(
      text.map((page) =>
        page.items.filter((item) => "str" in item).map((item) => item.str),
      ),
    ).toEqual([
      ["PAGE 4", "PAGE 1"],
      ["PAGE 2", "PAGE 3"],
    ]);
    for (const page of text)
      for (const item of page.items)
        if ("transform" in item) {
          expect(item.transform[4]).toBeGreaterThanOrEqual(0);
          expect(item.transform[4]).toBeLessThan(PAPERS.A4.width);
          expect(item.transform[5]).toBeGreaterThanOrEqual(0);
          expect(item.transform[5]).toBeLessThan(PAPERS.A4.height);
        }
    const p2 = text[1].items.find(
      (item) => "str" in item && item.str === "PAGE 2",
    );
    expect(p2 && "transform" in p2 && p2.transform[0]).toBeCloseTo(0, 4);
    expect(p2 && "transform" in p2 && p2.transform[1]).toBeLessThan(0);
  });
  test("nonzero CropBox origins are translated into the output slot", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([600, 800]);
    page.setCropBox(100, 150, 300, 400);
    page.drawText("CROP", { x: 110, y: 160, size: 20 });
    const bytes = await impose(await loadSource(await source.save()), {
      paper: "A4",
      binding: "left",
      marginMm: 0,
    });
    const text = await readText(bytes);
    const item = text[0].items.find(
      (item) => "str" in item && item.str === "CROP",
    );
    const scale = Math.min(PAPERS.A4.width / 2 / 300, PAPERS.A4.height / 400);
    expect(item && "transform" in item && item.transform[4]).toBeCloseTo(
      PAPERS.A4.width / 2 + 10 * scale,
      3,
    );
  });
  test("all-blank documents produce valid printable output", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const output = await PDFDocument.load(
      await impose(await loadSource(await source.save()), {
        paper: "A4",
        binding: "left",
        marginMm: 5,
      }),
    );
    expect(output.getPageCount()).toBe(2);
  });
  test("twelve-page print test exports all page numbers", async () => {
    const source = await loadSource(await createSample());
    const text = await readText(
      await impose(source, { paper: "A4", binding: "left", marginMm: 5 }),
    );
    const textItems = text.flatMap((page) =>
      page.items.filter((item) => "str" in item).map((item) => item.str),
    );
    for (let i = 1; i <= 12; i++)
      expect(textItems).toContain(`Page ${i} of 12`);
  });
});

describe("input boundaries", () => {
  test("rejects non-PDF and oversized bytes before parsing", async () => {
    await expect(loadSource(new TextEncoder().encode("hello"))).rejects.toThrow(
      "不是",
    );
    await expect(loadSource(new Uint8Array(MAX_BYTES + 1))).rejects.toThrow(
      "40 MB",
    );
  });
  test("rejects truncated data and too many pages", async () => {
    await expect(
      loadSource(new TextEncoder().encode("%PDF-broken")),
    ).rejects.toThrow("無法開啟");
    const source = await PDFDocument.create();
    for (let i = 0; i < 161; i++) source.addPage();
    await expect(loadSource(await source.save())).rejects.toThrow("160");
  });
  test("rejects forms instead of silently dropping their values", async () => {
    const source = await fixture(1);
    const form = source.getForm().createTextField("name");
    form.setText("Must be retained");
    form.addToPage(source.getPage(0));
    await expect(loadSource(await source.save())).rejects.toThrow("表單");
  });
  test("allows link hotspots but rejects annotation artwork", async () => {
    const source = await fixture(1);
    const link = source.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [0, 0, 50, 50],
      A: { S: "URI", URI: "https://example.org" },
    });
    source
      .getPage(0)
      .node.set(
        PDFName.of("Annots"),
        source.context.obj([source.context.register(link)]),
      );
    await expect(loadSource(await source.save())).resolves.toBeDefined();
    link.set(PDFName.of("Subtype"), PDFName.of("Text"));
    await expect(loadSource(await source.save())).rejects.toThrow("註解");
  });
  test("rejects crop boxes outside physical media", async () => {
    const source = await fixture(1);
    source.getPage(0).setCropBox(-10, 0, 310, 400);
    await expect(loadSource(await source.save())).rejects.toThrow("裁切");
  });
  test.each([-1, 21, NaN])("rejects invalid margin %s", async (marginMm) => {
    await expect(
      impose(await fixture(1), { paper: "A4", binding: "left", marginMm }),
    ).rejects.toThrow("留白");
  });
});
