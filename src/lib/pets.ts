import { db } from "./db";
import {
  petInput,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  publicProjection,
} from "./pet-rules";
import { HttpError } from "./http";
import { putObject, deleteObject } from "./storage";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
const include = { images: { orderBy: { createdAt: "asc" as const } } };
export async function ownedPet(ownerId: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, "Pet not found.");
  const pet = await db.pet.findFirst({ where: { id, ownerId }, include });
  if (!pet) throw new HttpError(404, "Pet not found.");
  return pet;
}
export async function savePet(ownerId: string, input: unknown, id?: string) {
  const parsed = petInput.parse(input);
  const data = {
    ...parsed,
    birthDate:
      parsed.birthPrecision === "UNKNOWN"
        ? null
        : new Date(parsed.birthDate! + "T00:00:00Z"),
  };
  return db.$transaction(async (tx) => {
    if (id) {
      const current = await tx.pet.findFirst({ where: { id, ownerId } });
      if (!current) throw new HttpError(404, "Pet not found.");
    }
    const pet = id
      ? await tx.pet.update({ where: { id, ownerId }, data, include })
      : await tx.pet.create({
          data: { ...data, ownerId, ownerships: { create: { ownerId } } },
          include,
        });
    await tx.auditLog.create({
      data: {
        actorId: ownerId,
        petId: pet.id,
        action: id ? "Updated pet profile" : "Added a pet",
      },
    });
    return pet;
  });
}
export async function setPetState(
  ownerId: string,
  id: string,
  input: { visibility?: string; status?: string; confirmed?: boolean },
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${id}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
    const pet = await tx.pet.findFirst({ where: { id, ownerId } });
    if (!pet) throw new HttpError(404, "Pet not found.");
    const data: {
      visibility?: "PUBLIC" | "PRIVATE";
      status?: "ACTIVE" | "ARCHIVED" | "DECEASED";
      deceasedAt?: Date | null;
    } = {};
    if (input.visibility) {
      if (!["PUBLIC", "PRIVATE"].includes(input.visibility))
        throw new HttpError(400, "Choose a visibility setting.");
      if (
        input.visibility === "PUBLIC" &&
        (!input.confirmed || pet.status !== "ACTIVE")
      )
        throw new HttpError(
          400,
          "Preview and confirm an active pet before publishing.",
        );
      data.visibility = input.visibility as "PUBLIC" | "PRIVATE";
    }
    if (input.status) {
      if (!["ACTIVE", "ARCHIVED", "DECEASED"].includes(input.status))
        throw new HttpError(400, "Choose a valid pet status.");
      data.status = input.status as "ACTIVE" | "ARCHIVED" | "DECEASED";
      if (input.status !== "ACTIVE") data.visibility = "PRIVATE";
      data.deceasedAt = input.status === "DECEASED" ? new Date() : null;
    }
    const updated = await tx.pet.update({
      where: { id, ownerId },
      data,
      include,
    });
    await tx.auditLog.create({
      data: {
        actorId: ownerId,
        petId: id,
        action: input.visibility
          ? `Changed visibility to ${input.visibility.toLowerCase()}`
          : `Marked pet ${input.status?.toLowerCase()}`,
      },
    });
    return updated;
  });
}
export async function uploadPhoto(
  ownerId: string,
  petId: string,
  file: File,
  view: string,
  replaceId?: string,
) {
  await ownedPet(ownerId, petId);
  if (file.size > MAX_PHOTO_BYTES || file.size === 0)
    throw new HttpError(400, "Choose an image up to 10 MB.");
  if (!["FRONT", "LEFT", "RIGHT", "UNSPECIFIED"].includes(view))
    throw new HttpError(400, "Choose a photo view.");
  const input = Buffer.from(await file.arrayBuffer());
  let full: Buffer, thumb: Buffer;
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
      throw new Error("format");
    full = await image
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toBuffer();
    thumb = await sharp(full)
      .resize(600, 600, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "Choose a valid, non-animated JPEG, PNG or WebP image under 40 megapixels.",
    );
  }
  const imageId = randomUUID(),
    objectKey = `${imageId}/full.webp`,
    thumbKey = `${imageId}/thumb.webp`;
  const result = await db
    .$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${ownerId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${petId}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
        const pet = await tx.pet.findFirst({
          where: { id: petId, ownerId },
          include,
        });
        if (!pet) throw new HttpError(404, "Pet not found.");
        const old = replaceId
          ? pet.images.find((i) => i.id === replaceId)
          : null;
        if (replaceId && !old) throw new HttpError(404, "Photo not found.");
        if (!old && pet.images.length >= MAX_PHOTOS)
          throw new HttpError(
            400,
            "Your pet already has three photos. Replace or remove one first.",
          );
        const healthUsage = await tx.attachment.aggregate({
          where: { record: { pet: { ownerId } } },
          _sum: { bytes: true },
        });
        const usage = await tx.petImage.aggregate({
          where: { pet: { ownerId } },
          _sum: { bytes: true },
        });
        if (
          (usage._sum.bytes || 0) +
            (healthUsage._sum.bytes || 0) -
            (old?.bytes || 0) +
            full.length +
            thumb.length >
          150 * 1024 * 1024
        )
          throw new HttpError(
            400,
            "Your account has reached its 150 MB storage allowance. Remove unused identity photos; removed medical files are retained for 30 days.",
          );
        await putObject(objectKey, full);
        await putObject(thumbKey, thumb);
        const image = await tx.petImage.create({
          data: {
            id: imageId,
            petId,
            uploadedBy: ownerId,
            objectKey,
            thumbKey,
            bytes: full.length + thumb.length,
            view,
          },
        });
        if (!pet.mainImageId || pet.mainImageId === old?.id)
          await tx.pet.update({
            where: { id: petId },
            data: { mainImageId: imageId },
          });
        if (old) await tx.petImage.delete({ where: { id: old.id } });
        await tx.auditLog.create({
          data: {
            actorId: ownerId,
            petId,
            action: old ? "Replaced a pet photo" : "Added a pet photo",
          },
        });
        return { image, old };
      },
      { timeout: 20000 },
    )
    .catch(async (error) => {
      await Promise.allSettled([
        deleteObject(objectKey),
        deleteObject(thumbKey),
      ]);
      throw error;
    });
  if (result.old)
    await Promise.allSettled([
      deleteObject(result.old.objectKey),
      deleteObject(result.old.thumbKey),
    ]);
  return result.image;
}
export async function changePhoto(
  ownerId: string,
  petId: string,
  imageId: string,
  remove: boolean,
) {
  const old = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${petId}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
    const pet = await tx.pet.findFirst({
      where: { id: petId, ownerId },
      include,
    });
    const image = pet?.images.find((i) => i.id === imageId);
    if (!pet || !image) throw new HttpError(404, "Photo not found.");
    if (remove) {
      if (pet.mainImageId === imageId)
        await tx.pet.update({
          where: { id: petId },
          data: {
            mainImageId: pet.images.find((i) => i.id !== imageId)?.id || null,
          },
        });
      await tx.petImage.delete({ where: { id: imageId } });
    } else
      await tx.pet.update({
        where: { id: petId },
        data: { mainImageId: imageId },
      });
    await tx.auditLog.create({
      data: {
        actorId: ownerId,
        petId,
        action: remove ? "Removed a pet photo" : "Changed main photo",
      },
    });
    return image;
  });
  if (remove)
    await Promise.allSettled([
      deleteObject(old.objectKey),
      deleteObject(old.thumbKey),
    ]);
}
export { publicProjection };
