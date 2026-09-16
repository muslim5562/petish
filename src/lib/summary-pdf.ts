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
  function text(value: string, size = 10.5, heavy = false, gap = 7) {
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
      page.drawText(line, { x: left, y, size, font, color });
      y -= size * 1.45;
    }
    y -= gap;
  }
  function heading(value: string) {
    if (y < 135) next();
    y -= 7;
    text(value, 14, true, 9);
  }
  doc.setTitle("Petish health summary");
  doc.setAuthor("Petish");
  doc.setSubject("Owner-selected health summary snapshot");
  text("petish / HEALTH SUMMARY", 11, true, 14);
  text(content.heading, 23, true, 12);
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
