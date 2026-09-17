import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { SummaryContent } from "./share-rules";

export async function summaryPdf(
  content: SummaryContent,
  regularBytes: Uint8Array,
  boldBytes: Uint8Array,
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const supported = new Set(regular.getCharacterSet());
  const color = rgb(0.2, 0.16, 0.24);
  let page = doc.addPage([595.28, 841.89]);
  let y = 783;
  const left = 48,
    width = 499;
  function next() {
    page = doc.addPage([595.28, 841.89]);
    y = 783;
  }
  function text(
    value: string,
    size = 10.5,
    heavy = false,
    gap = 7,
    ink = color,
  ) {
    const font = heavy ? bold : regular;
    const clean = value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
    for (const c of clean)
      if (c !== "\n" && !supported.has(c.codePointAt(0)!))
        throw new Error(
          "This PDF font cannot display some characters in the selected summary. Use the protected link to preserve the original text.",
        );
    const lines: string[] = [];
    for (const paragraph of clean.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/ +/)) {
        const joined = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(joined, size) <= width) {
          line = joined;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const c of word) {
          if (font.widthOfTextAtSize(line + c, size) > width) {
            lines.push(line);
            line = "";
          }
          line += c;
        }
      }
      lines.push(line);
    }
    for (const line of lines) {
      if (y < 65) next();
      page.drawText(line, { x: left, y, size, font, color: ink });
      y -= size * 1.45;
    }
    y -= gap;
  }
  function heading(value: string) {
    if (y < 135) next();
    y -= 7;
    text(value, 14, true, 9, rgb(0.43, 0.23, 0.36));
  }
  doc.setTitle("Petish health summary");
  doc.setAuthor("Petish");
  doc.setSubject("Owner-selected health summary snapshot");
  const headerTop = 805;
  const titleRows = Math.max(
    1,
    Math.ceil(bold.widthOfTextAtSize(content.heading, 20) / width),
  );
  const headerHeight = 50 + (titleRows === 1 ? 1 : titleRows + 1) * 29;
  page.drawRectangle({
    x: 34,
    y: headerTop - headerHeight,
    width: 527,
    height: headerHeight,
    color: rgb(0.95, 0.92, 0.96),
    borderColor: rgb(0.55, 0.38, 0.56),
    borderWidth: 1,
  });
  text("petish / HEALTH SUMMARY", 10, true, 12, rgb(0.43, 0.23, 0.36));
  text(content.heading, 20, true, 12, rgb(0.25, 0.15, 0.29));
  y = headerTop - headerHeight - 25;
  text("Snapshot captured: " + new Date(content.capturedAt).toISOString(), 9);
  if (content.lastUpdated)
    text(
      "Source history last updated: " +
        new Date(content.lastUpdated).toISOString(),
      9,
    );
  text(
    "Saved PDF copy: no expiry or revocation. Share only with people you choose.",
    10,
    true,
    12,
  );
  for (const field of content.identity) text(field.label + ": " + field.value);
  text(content.provenance, 10, false, 12);
  for (const section of content.sections) {
    heading(section.title);
    if (section.note) text(section.note, 10);
    if (!section.items.length) text("No entries included in this section.");
    for (const item of section.items) {
      if (y < 110) next();
      text(item.title, 11, true);
      for (const field of item.fields) text(field.label + ": " + field.value);
      y -= 5;
    }
  }
  heading("About this copy");
  text(content.omissionNotice, 9);
  text(
    "This PDF does not update when the pet's records change. Link expiry or revocation cannot remove downloaded or forwarded copies.",
    9,
  );
  for (const [index, p] of doc.getPages().entries()) {
    p.drawLine({
      start: { x: left, y: 43 },
      end: { x: 547, y: 43 },
      thickness: 0.5,
      color: rgb(0.8, 0.78, 0.81),
    });
    p.drawText(
      `Petish | Owner-selected snapshot | ${index + 1} / ${doc.getPageCount()}`,
      { x: left, y: 28, size: 8, font: regular, color },
    );
  }
  return doc.save();
}
