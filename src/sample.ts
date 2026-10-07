import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Original twelve-page specimen; all artwork is vector geometry and live type. */
export async function createSample(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.17, 0.18, 0.15),
    red = rgb(0.84, 0.23, 0.14),
    cream = rgb(0.98, 0.96, 0.9);
  const chapters = [
    ["Small things,", "made slowly."],
    ["A note", "on paper."],
    ["01", "Look closely."],
    ["A page is", "a place."],
    ["02", "Leave room."],
    ["Less ink.", "More space."],
    ["03", "Make a mark."],
    ["A useful", "little thing."],
    ["04", "Fold here."],
    ["Ideas need", "a surface."],
    ["Keep it.", "Pass it on."],
    ["The end.", "The beginning."],
  ];
  for (let i = 0; i < 12; i++) {
    const page = pdf.addPage([420, 595]);
    const reverse = i === 0 || i === 11;
    const foreground = reverse ? cream : ink;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 420,
      height: 595,
      color: reverse ? red : cream,
    });
    page.drawText("FOLDPRESS  /  PAPER STUDIES", {
      x: 32,
      y: 550,
      size: 9,
      font: sans,
      color: foreground,
    });
    page.drawLine({
      start: { x: 32, y: 533 },
      end: { x: 388, y: 533 },
      thickness: 0.6,
      color: foreground,
    });
    page.drawText(chapters[i][0], {
      x: 32,
      y: 460,
      size: 42,
      font: serif,
      color: foreground,
    });
    page.drawText(chapters[i][1], {
      x: 32,
      y: 412,
      size: 39,
      font: italic,
      color: foreground,
    });
    if (reverse) {
      page.drawCircle({
        x: 210,
        y: 228,
        size: 102,
        borderWidth: 1,
        borderColor: cream,
      });
      page.drawLine({
        start: { x: 210, y: 111 },
        end: { x: 210, y: 345 },
        thickness: 1,
        color: cream,
      });
      page.drawText(i === 0 ? "A LITTLE BOOK" : "PRINT. FOLD. KEEP.", {
        x: i === 0 ? 167 : 151,
        y: 223,
        size: 10,
        font: sans,
        color: cream,
      });
    } else {
      for (let n = 0; n < 6; n++) {
        page.drawRectangle({
          x: 32 + (n % 3) * 122,
          y: 160 + Math.floor(n / 3) * 82,
          width: 108,
          height: 68,
          borderWidth: 0.6,
          borderColor: red,
        });
        page.drawLine({
          start: { x: 86 + (n % 3) * 122, y: 160 + Math.floor(n / 3) * 82 },
          end: { x: 86 + (n % 3) * 122, y: 228 + Math.floor(n / 3) * 82 },
          thickness: 0.5,
          color: red,
        });
      }
      page.drawText("An ordinary sheet. An unexpected possibility.", {
        x: 32,
        y: 113,
        size: 11,
        font: italic,
        color: ink,
      });
    }
    page.drawLine({
      start: { x: 32, y: 61 },
      end: { x: 388, y: 61 },
      thickness: 0.6,
      color: foreground,
    });
    page.drawText(`NO. ${String(i + 1).padStart(2, "0")}`, {
      x: 32,
      y: 39,
      size: 9,
      font: sans,
      color: foreground,
    });
    page.drawText("A PRINT-AT-HOME SPECIMEN", {
      x: 254,
      y: 39,
      size: 8,
      font: sans,
      color: foreground,
    });
  }
  pdf.setTitle("Paper studies — Foldpress specimen");
  return pdf.save();
}
