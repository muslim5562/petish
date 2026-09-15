import sharp from "sharp";
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFRawStream } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { ownedPet } from "./pets";
import { HttpError } from "./http";
import { putObject, deleteObject } from "./storage";
import { healthInclude, lockHealthPet, snapshot, validId } from "./health";
import {
  MAX_ATTACHMENTS,
  MAX_HEALTH_FILE_BYTES,
  MAX_ACCOUNT_BYTES,
} from "./health-rules";
import type { PDFObject } from "pdf-lib";
const forbidden = new Set([
  "JavaScript",
  "JS",
  "OpenAction",
  "AA",
  "Launch",
  "EmbeddedFiles",
  "RichMedia",
  "XFA",
  "AcroForm",
  "Encrypt",
  "SubmitForm",
  "GoToR",
  "GoToE",
  "URI",
  "Filespec",
]);
function inspectPdf(object: PDFObject, seen = new Set<PDFObject>()) {
  if (seen.has(object)) return;
  seen.add(object);
  if (object instanceof PDFName && forbidden.has(object.decodeText()))
    throw new Error(
      "This PDF contains interactive content. Export a flattened PDF and try again.",
    );
  if (object instanceof PDFRawStream) inspectPdf(object.dict, seen);
  if (object instanceof PDFDict)
    for (const [key, value] of object.entries()) {
      inspectPdf(key, seen);
      inspectPdf(value, seen);
    }
  if (object instanceof PDFArray)
    for (const v of object.asArray()) inspectPdf(v, seen);
}
export async function validateHealthFile(file: File) {
  if (!file.size || file.size > MAX_HEALTH_FILE_BYTES)
    throw new HttpError(400, "Choose a file up to 20 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  if (input.subarray(0, 5).toString() === "%PDF-") {
    try {
      const pdf = await PDFDocument.load(input, {
        ignoreEncryption: false,
        updateMetadata: false,
      });
      if (pdf.isEncrypted || pdf.getPageCount() > 200 || pdf.getPageCount() < 1)
        throw new Error("Use an unencrypted PDF with 1–200 pages.");
      for (const [, object] of pdf.context.enumerateIndirectObjects())
        inspectPdf(object);
      pdf.catalog.delete(PDFName.of("Metadata"));
      pdf.setAuthor("");
      pdf.setCreator("");
      pdf.setProducer("Petish private document");
      pdf.setTitle("");
      pdf.setSubject("");
      pdf.setKeywords([]);
      return {
        body: Buffer.from(await pdf.save({ useObjectStreams: false })),
        thumb: null,
        mime: "application/pdf",
        extension: "pdf",
      };
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error && e.message.startsWith("This PDF")
          ? e.message
          : "Use a valid, unencrypted, non-interactive PDF with 1–200 pages.",
      );
    }
  }
  try {
    const image = sharp(input, {
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error("Invalid");
    const body = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
    const thumb = await sharp(body)
      .resize({
        width: 500,
        height: 500,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    return { body, thumb, mime: "image/webp", extension: "webp" };
  } catch {
    throw new HttpError(
      400,
      "Choose a valid JPEG, PNG, WebP, or non-interactive PDF. Images must be under 40 megapixels.",
    );
  }
}
export async function limitedForm(req: Request) {
  const max = MAX_HEALTH_FILE_BYTES + 1024 * 1024;
  if (Number(req.headers.get("content-length") || 0) > max)
    throw new HttpError(413, "Choose a file up to 20 MB.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Choose a file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Choose a file up to 20 MB.");
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": req.headers.get("content-type") || "" },
  }).formData();
}
export async function addHealthFile(
  ownerId: string,
  petId: string,
  recordId: string,
  file: File,
  description: string,
) {
  await ownedPet(ownerId, petId);
  validId(recordId);
  if (description.length > 300)
    throw new HttpError(400, "Keep the file description under 300 characters.");
  const before = await db.healthRecord.findFirst({
    where: { id: recordId, petId, deletedAt: null },
  });
  if (!before) throw new HttpError(404, "Record not found.");
  const prepared = await validateHealthFile(file);
  const id = randomUUID(),
    objectKey = `${id}/${prepared.extension === "pdf" ? "document.pdf" : "full.webp"}`,
    thumbKey = prepared.thumb ? `${id}/thumb.webp` : null;
  const basename =
    file.name
      .replace(/[\x00-\x1f\x7f\\/]/g, "")
      .replace(/\.[^.]+$/, "")
      .slice(0, 120) || "Document";
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "user" WHERE id=${ownerId}::uuid FOR UPDATE`;
        await lockHealthPet(tx, ownerId, petId);
        const record = await tx.healthRecord.findFirst({
          where: { id: recordId, petId, deletedAt: null },
          include: healthInclude,
        });
        if (!record) throw new HttpError(404, "Record not found.");
        if (record.attachments.length >= MAX_ATTACHMENTS)
          throw new HttpError(
            400,
            "This entry already has five files. Remove a file before adding another.",
          );
        const [photoUsage, healthUsage] = await Promise.all([
          tx.petImage.aggregate({
            where: { pet: { ownerId } },
            _sum: { bytes: true },
          }),
          tx.attachment.aggregate({
            where: { record: { pet: { ownerId } } },
            _sum: { bytes: true },
          }),
        ]);
        const bytes = prepared.body.length + (prepared.thumb?.length || 0);
        if (
          (photoUsage._sum.bytes || 0) + (healthUsage._sum.bytes || 0) + bytes >
          MAX_ACCOUNT_BYTES
        )
          throw new HttpError(
            400,
            "Your account has reached its 150 MB storage allowance. Removed medical files are retained for 30 days.",
          );
        await putObject(objectKey, prepared.body, prepared.mime);
        if (thumbKey && prepared.thumb)
          await putObject(thumbKey, prepared.thumb);
        await tx.attachment.create({
          data: {
            id,
            recordId,
            objectKey,
            thumbKey,
            filename: `${basename}.${prepared.extension}`,
            description: description.trim() || null,
            mime: prepared.mime,
            bytes,
            uploadedBy: ownerId,
          },
        });
        const saved = await tx.healthRecord.update({
          where: { id: recordId },
          data: { version: { increment: 1 }, updatedBy: ownerId },
          include: healthInclude,
        });
        await tx.healthRevision.create({
          data: {
            recordId,
            version: saved.version,
            actorId: ownerId,
            action: "Added attachment",
            snapshot: snapshot(saved),
          },
        });
        return saved;
      },
      { timeout: 25000 },
    );
  } catch (e) {
    await Promise.allSettled([
      deleteObject(objectKey),
      ...(thumbKey ? [deleteObject(thumbKey)] : []),
    ]);
    throw e;
  }
}
export async function removeHealthFile(
  ownerId: string,
  petId: string,
  recordId: string,
  id: string,
  version: number,
) {
  validId(recordId);
  validId(id);
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const r = await tx.healthRecord.findFirst({
      where: { id: recordId, petId, deletedAt: null },
    });
    if (!r) throw new HttpError(404, "Record not found.");
    if (r.version !== version)
      throw new HttpError(409, "The record changed. Refresh it and try again.");
    const file = await tx.attachment.findFirst({
      where: { id, recordId, deletedAt: null },
    });
    if (!file) throw new HttpError(404, "File not found.");
    await tx.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const saved = await tx.healthRecord.update({
      where: { id: recordId },
      data: { version: { increment: 1 }, updatedBy: ownerId },
      include: healthInclude,
    });
    await tx.healthRevision.create({
      data: {
        recordId,
        version: saved.version,
        actorId: ownerId,
        action: "Removed attachment from view; retained for 30 days",
        snapshot: snapshot(saved),
      },
    });
    return saved;
  });
}
