import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** A numbered twelve-page document for checking duplex orientation and fold order. */
export async function createSample(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.15, 0.17, 0.14);
  const muted = rgb(0.43, 0.46, 0.41);
  const line = rgb(0.76, 0.78, 0.73);

  for (let number = 1; number <= 12; number++) {
    const page = pdf.addPage([420, 595]);
    // The arrow and top label make reversed duplex printing visible at a glance.
    page.drawText("TOP", { x: 199, y: 540, size: 10, font: bold, color: ink });
    page.drawLine({
      start: { x: 210, y: 555 },
      end: { x: 210, y: 579 },
      thickness: 1.2,
      color: ink,
    });
    page.drawLine({
      start: { x: 210, y: 579 },
      end: { x: 204, y: 572 },
      thickness: 1.2,
      color: ink,
    });
    page.drawLine({
      start: { x: 210, y: 579 },
      end: { x: 216, y: 572 },
      thickness: 1.2,
      color: ink,
    });
    page.drawText("BOOKLET TEST", {
      x: 30,
      y: 501,
      size: 10,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: 30, y: 484 },
      end: { x: 390, y: 484 },
      thickness: 0.6,
      color: line,
    });
    const label =
      number === 1
        ? "Front cover"
        : number === 12
          ? "Back cover"
          : "Inside page";
    page.drawText(label, {
      x: 30,
      y: 454,
      size: 16,
      font: regular,
      color: ink,
    });
    const numeral = String(number);
    const size = 182;
    page.drawText(numeral, {
      x: (420 - bold.widthOfTextAtSize(numeral, size)) / 2,
      y: 240,
      size,
      font: bold,
      color: ink,
    });
    const instructions =
      number === 1 || number === 12
        ? [
            "This page belongs on the outside.",
            "After folding, all arrows should point up.",
          ]
        : [
            "After folding, pages should run from 1 to 12.",
            "If this arrow points down, change the duplex setting.",
          ];
    instructions.forEach((text, index) =>
      page.drawText(text, {
        x: 30,
        y: 158 - index * 20,
        size: 11,
        font: regular,
        color: muted,
      }),
    );
    page.drawLine({
      start: { x: 30, y: 81 },
      end: { x: 390, y: 81 },
      thickness: 0.6,
      color: line,
    });
    page.drawText(`Page ${number} of 12`, {
      x: 30,
      y: 54,
      size: 10,
      font: regular,
      color: muted,
    });
    page.drawText("Read in numerical order after folding", {
      x: 208,
      y: 54,
      size: 9,
      font: regular,
      color: muted,
    });
  }
  pdf.setTitle("Booklet print test - 12 pages");
  return pdf.save();
}
