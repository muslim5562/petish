import { randomBytes, randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db } from "./db";
import { auth } from "./auth";
import { HttpError, checkOrigin } from "./http";
import { sendMail } from "./mail";
import { putObject, getObject, deleteObject } from "./storage";
import { uploadPhoto } from "./pets";
import type { BoardReport } from "@/generated/prisma/client";

export const boardHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, noarchive",
  "X-Content-Type-Options": "nosniff",
};
const day = 86400000;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const origin = () => new URL(process.env.BETTER_AUTH_URL!).origin;
const text = (max: number) => z.string().trim().max(max).default("");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return (
      Number.isFinite(+d) &&
      d.toISOString().slice(0, 10) === v &&
      v <= new Date().toISOString().slice(0, 10) &&
      v >= "2000-01-01"
    );
  }, "Choose a valid date that is not in the future.");
const reportInput = z
  .object({
    kind: z.enum(["MISSING", "FOUND"]),
    petId: z.string().uuid().optional(),
    email: z.string().trim().email().max(254).optional(),
    petName: text(60),
    species: z.enum(["CAT", "DOG"]),
    breed: text(100),
    colour: text(80),
    details: z.string().trim().min(10).max(2000),
    locality: z.string().trim().min(2).max(160),
    occurredAt: date,
    approximateTime: text(60),
    custody: z.enum(["IN_CARE", "ROAMING"]).optional(),
    phone: text(40),
    publicPhone: z.boolean().default(false),
    reward: text(160),
    photoReuse: z.boolean().default(false),
    consent: z.literal(true),
    website: z.string().max(0).default(""),
    photoIds: z.array(z.string().uuid()).max(2).default([]),
  })
  .superRefine((v, c) => {
    if (v.kind === "MISSING" && (!v.petId || !v.phone || !v.publicPhone))
      c.addIssue({
        code: "custom",
        message:
          "Missing reports need your pet, contact number, and permission to publish that number.",
      });
    if (v.kind === "FOUND" && !v.custody)
      c.addIssue({
        code: "custom",
        message: "Choose whether the pet is in your care or was seen roaming.",
      });
  });
const responseInput = z.object({
  email: z.string().trim().email().max(254),
  kind: z.enum(["SEEN", "IN_CARE", "CLAIM"]),
  locality: z.string().trim().min(2).max(160),
  occurredAt: date,
  details: z.string().trim().min(10).max(2000),
  phone: text(40),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
});
type Viewer = { id: string; email: string; emailVerified: boolean };
export async function viewer(req: Request): Promise<Viewer | null> {
  const s = await auth.api.getSession({ headers: req.headers });
  return s?.user.emailVerified ? s.user : null;
}
export function moderator(v: Viewer | null) {
  return (
    !!v &&
    (process.env.LOST_FOUND_MODERATOR_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(v.email.toLowerCase())
  );
}
export async function rate(key: string, max: number) {
  const bucket = Math.floor(Date.now() / 3600000);
  const id = digest(`board:${key}:${bucket}`);
  const row = await db.boardRate.upsert({
    where: { id },
    create: { id, count: 1, expiresAt: new Date((bucket + 2) * 3600000) },
    update: { count: { increment: 1 } },
  });
  if (row.count > max)
    throw new HttpError(
      429,
      "Too many submissions. Please wait before trying again.",
    );
}
export async function limitedBody(req: Request, max = 24 * 1024 * 1024) {
  if (Number(req.headers.get("content-length") || 0) > max)
    throw new HttpError(413, "Submission is too large.");
  const reader = req.body?.getReader();
  let size = 0;
  const parts: Uint8Array[] = [];
  if (reader)
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Submission is too large.");
      }
      parts.push(r.value);
    }
  return new Response(Buffer.concat(parts), {
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
    },
  });
}
async function form(req: Request) {
  const data = await (await limitedBody(req)).formData();
  let value: unknown;
  try {
    value = JSON.parse(String(data.get("data") || "{}"));
  } catch {
    throw new HttpError(400, "Check the form details.");
  }
  const files = data.getAll("photos");
  if (files.length > 2 || files.some((f) => !(f instanceof File)))
    throw new HttpError(400, "Choose up to two photos.");
  return { value, files: files as File[] };
}
async function photo(file: File) {
  if (
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new HttpError(
      400,
      "Choose JPEG, PNG or WebP photos under 10 MB each.",
    );
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40000000, animated: false });
    const m = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(m.format || "") || (m.pages || 1) > 1)
      throw Error();
    const full = await image
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const thumb = await sharp(full)
      .resize(600, 600, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    const id: string = randomUUID();
    return {
      id,
      objectKey: `${id}/full.webp`,
      thumbKey: `${id}/thumb.webp`,
      bytes: full.length + thumb.length,
      full,
      thumb,
    };
  } catch {
    throw new HttpError(400, "One of the photos is invalid or animated.");
  }
}
async function photos(files: File[]) {
  const prepared = await Promise.all(files.map(photo));
  try {
    for (const p of prepared) {
      await putObject(p.objectKey, p.full);
      await putObject(p.thumbKey, p.thumb);
    }
  } catch (e) {
    await Promise.allSettled(
      prepared.flatMap((p) => [
        deleteObject(p.objectKey),
        deleteObject(p.thumbKey),
      ]),
    );
    throw e;
  }
  return prepared;
}
async function cleanPhotos(p: { objectKey: string; thumbKey: string }[]) {
  await Promise.allSettled(
    p.flatMap((x) => [deleteObject(x.objectKey), deleteObject(x.thumbKey)]),
  );
}
async function mail(to: string, subject: string, url: string) {
  try {
    await sendMail(to, subject, url);
    return true;
  } catch {
    return false;
  }
}
async function access(
  reportId: string,
  email: string,
  kind: string,
  responseId?: string,
) {
  const token = randomBytes(32).toString("base64url");
  await db.boardAccess.create({
    data: {
      reportId,
      email,
      kind,
      responseId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + (kind === "MANAGE" ? 30 : 7) * day),
    },
  });
  return token;
}
export async function tokenAccess(token: unknown) {
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) return null;
  return db.boardAccess.findFirst({
    where: { tokenHash: digest(token), expiresAt: { gt: new Date() } },
  });
}
export async function canManage(
  report: BoardReport,
  v: Viewer | null,
  token?: unknown,
) {
  if (v && report.ownerId === v.id) return true;
  const a = await tokenAccess(token);
  return (
    !!a &&
    a.kind === "MANAGE" &&
    a.reportId === report.id &&
    a.email === report.email
  );
}
export async function visible(r: BoardReport) {
  if (r.state !== "OPEN" || +r.confirmedAt < Date.now() - 60 * day)
    return false;
  if (r.kind === "MISSING") {
    const p = await db.pet.findUnique({
      where: { id: r.petId! },
      select: { ownerId: true, status: true },
    });
    if (
      !p ||
      p.ownerId !== r.ownerId ||
      ["DECEASED", "REHOMED"].includes(p.status)
    )
      return false;
  }
  return true;
}
export async function publicReport(r: BoardReport, detail = false) {
  return {
    id: r.id,
    kind: r.kind,
    petName: r.petName,
    species: r.species,
    breed: r.breed,
    colour: r.colour,
    details: r.details,
    locality: r.locality,
    occurredAt: r.occurredAt,
    approximateTime: r.approximateTime,
    custody: r.custody,
    reward: r.reward,
    createdAt: r.createdAt,
    ...(detail && r.publicPhone ? { phone: r.phone } : {}),
    photos: (
      await db.boardPhoto.findMany({
        where: { reportId: r.id, responseId: null },
        select: { id: true },
      })
    ).map((p) => ({ id: p.id, url: `/api/lost-found/photos/${p.id}` })),
  };
}
const responseSubject = (r: BoardReport) =>
  r.kind === "MISSING"
    ? "A possible pet sighting was submitted"
    : "Someone thinks this may be their pet";
const notificationData = (r: BoardReport, subject: string) => ({
  reportId: r.id,
  ownerId: r.ownerId,
  email: r.email,
  subject,
});
export async function notify(
  r: BoardReport,
  subject: string,
  id: string = randomUUID(),
) {
  const n = await db.boardNotification.upsert({
    where: { id },
    create: { id, ...notificationData(r, subject) },
    update: {},
  });
  if (n.sentAt) return;
  const sent = await mail(r.email, subject, origin() + "/lost-found/manage");
  await db.boardNotification.update({
    where: { id: n.id },
    data: { attempts: 1, sentAt: sent ? new Date() : null },
  });
}
export async function createReport(req: Request, v: Viewer | null) {
  checkOrigin(req);
  await rate("all-posts", 150);
  const { value, files } = await form(req);
  const d = reportInput.parse(value);
  if (process.env.PETISH_PHONE_PREVIEW === "true" && !v)
    throw new HttpError(
      403,
      "Guest email verification is unavailable in the temporary phone demo.",
    );
  const email = (v?.email || d.email || "").toLowerCase();
  if (!email) throw new HttpError(400, "Enter your private email address.");
  await rate(`post:${email}`, 5);
  let pet = null;
  if (d.kind === "MISSING") {
    if (!v) throw new HttpError(401, "Sign in to report your pet missing.");
    pet = await db.pet.findFirst({
      where: {
        id: d.petId,
        ownerId: v.id,
        status: { notIn: ["DECEASED", "REHOMED"] },
      },
      include: { images: true },
    });
    if (!pet) throw new HttpError(404, "Choose one of your current pets.");
  } else if (d.petId || d.photoIds.length)
    throw new HttpError(400, "Found reports use newly uploaded photos.");
  if (files.length + d.photoIds.length > 2)
    throw new HttpError(400, "Choose up to two report photos.");
  for (const id of d.photoIds) {
    const p = pet?.images.find((p) => p.id === id);
    if (!p) throw new HttpError(400, "Choose a photo from this pet.");
    files.push(
      new File([new Uint8Array(await getObject(p.objectKey))], "pet.webp", {
        type: "image/webp",
      }),
    );
  }
  if (!files.length)
    throw new HttpError(400, "Include at least one pet photo.");
  const prepared = await photos(files);
  let r;
  try {
    r = await db.$transaction(async (tx) => {
      if (pet) {
        await tx.$queryRaw`SELECT id FROM "Pet" WHERE id=${pet.id}::uuid FOR UPDATE`;
        const current = await tx.pet.findUnique({ where: { id: pet.id } });
        if (
          !current ||
          current.ownerId !== v?.id ||
          ["REHOMED", "DECEASED"].includes(current.status)
        )
          throw new HttpError(
            409,
            "This pet is no longer available for a missing report.",
          );
        if (
          await tx.boardReport.count({
            where: { petId: pet.id, state: { in: ["OPEN", "PENDING"] } },
          })
        )
          throw new HttpError(
            409,
            "This pet already has a missing report. Manage that report instead.",
          );
      }
      return tx.boardReport.create({
        data: {
          kind: d.kind,
          ownerId: v?.id,
          petId: pet?.id,
          email,
          petName: d.petName,
          species: d.species,
          breed: d.breed,
          colour: d.colour,
          details: d.details,
          locality: d.locality,
          occurredAt: new Date(d.occurredAt),
          approximateTime: d.approximateTime,
          custody: d.custody,
          phone: d.phone,
          publicPhone: d.publicPhone,
          reward: d.kind === "MISSING" ? d.reward : "",
          photoReuse: d.photoReuse,
          state: v ? "OPEN" : "PENDING",
          photos: {
            create: prepared.map(({ id, objectKey, thumbKey, bytes }) => ({
              id,
              objectKey,
              thumbKey,
              bytes,
            })),
          },
        },
      });
    });
  } catch (e) {
    await cleanPhotos(prepared);
    throw e;
  }
  if (v) return { id: r.id, state: r.state };
  const token = await access(r.id, email, "MANAGE");
  const sent = await mail(
    email,
    "Verify your Petish found report",
    origin() + "/lost-found/manage#" + token,
  );
  return {
    id: r.id,
    state: "PENDING",
    message: sent
      ? "Check your email to verify and publish this report."
      : "Your draft is saved, but email delivery failed. Use My reports to request a new management link.",
  };
}
export async function respond(req: Request, id: string, v: Viewer | null) {
  checkOrigin(req);
  if (process.env.PETISH_PHONE_PREVIEW === "true" && !v)
    throw new HttpError(
      403,
      "Guest email verification is unavailable in the temporary phone demo.",
    );
  await rate("all-responses", 300);
  const r = await db.boardReport.findUnique({ where: { id } });
  if (!r || !(await visible(r)))
    throw new HttpError(404, "This report is unavailable.");
  const { value, files } = await form(req);
  const d = responseInput.parse(value);
  if ((r.kind === "FOUND") !== (d.kind === "CLAIM"))
    throw new HttpError(400, "Choose a response appropriate for this report.");
  await rate(`response:${d.email.toLowerCase()}`, 8);
  const prepared = await photos(files);
  let response;
  try {
    response = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "BoardReport" WHERE id=${id}::uuid FOR UPDATE`;
      const fresh = await tx.boardReport.findUniqueOrThrow({ where: { id } });
      if (fresh.state !== "OPEN" || +fresh.confirmedAt < Date.now() - 60 * day)
        throw new HttpError(404, "This report is unavailable.");
      const createdResponse = await tx.boardResponse.create({
        data: {
          reportId: id,
          email: d.email.toLowerCase(),
          verified: !!v && v.email.toLowerCase() === d.email.toLowerCase(),
          kind: d.kind,
          locality: d.locality,
          occurredAt: new Date(d.occurredAt),
          details: d.details,
          phone: d.phone,
          photos: {
            create: prepared.map(
              ({ id: photoId, objectKey, thumbKey, bytes }) => ({
                id: photoId,
                reportId: id,
                objectKey,
                thumbKey,
                bytes,
              }),
            ),
          },
        },
      });
      if (createdResponse.verified)
        await tx.boardNotification.create({
          data: {
            id: createdResponse.id,
            ...notificationData(r, responseSubject(r)),
          },
        });
      return createdResponse;
    });
  } catch (e) {
    await cleanPhotos(prepared);
    throw e;
  }
  if (response.verified) {
    await notify(
      r,
      r.kind === "MISSING"
        ? "A possible pet sighting was submitted"
        : "Someone thinks this may be their pet",
      response.id,
    );
    return { message: "Your private response was sent to the report manager." };
  }
  const token = await access(
    id,
    d.email.toLowerCase(),
    "RESPONSE",
    response.id,
  );
  const sent = await mail(
    d.email,
    "Verify your private Petish response",
    origin() + "/lost-found/verify#" + token,
  );
  return {
    message: sent
      ? "Check your email to verify your response. It stays private to the report manager."
      : "Response saved but verification email failed. Use My reports to request another verification email.",
  };
}
export async function manage(
  req: Request,
  v: Viewer | null,
  body: Record<string, unknown>,
) {
  checkOrigin(req);
  const a = await tokenAccess(body.token);
  if (
    !z
      .string()
      .uuid()
      .safeParse(body.id || a?.reportId).success
  )
    throw new HttpError(404, "Report or management link unavailable.");
  let r = await db.boardReport.findUnique({
    where: { id: String(body.id || a?.reportId || "") },
  });
  if (!r || !(await canManage(r, v, body.token)))
    throw new HttpError(
      404,
      "Report not available to this account or management link.",
    );
  const action = String(body.action || "view");
  if (action === "publish") {
    if (r.state !== "PENDING")
      throw new HttpError(409, "This report cannot be published.");
    r = await db.boardReport.update({
      where: { id: r.id },
      data: { state: "OPEN", confirmedAt: new Date() },
    });
  } else if (action === "close") {
    const reason = z
      .enum(["REUNITED", "SAFE", "DUPLICATE", "WITHDRAWN", "OTHER"])
      .parse(body.reason);
    const claim = body.claimId
      ? await db.boardResponse.findFirst({
          where: {
            id: String(body.claimId),
            reportId: r.id,
            kind: "CLAIM",
            verified: true,
          },
        })
      : null;
    if (body.claimId && !claim)
      throw new HttpError(400, "Choose a verified claim from this report.");
    r = await db.boardReport.update({
      where: { id: r.id, state: r.state, updatedAt: r.updatedAt },
      data: {
        state: r.state === "HIDDEN" ? "HIDDEN" : "CLOSED",
        closedAt: new Date(),
        closureReason: reason,
      },
    });
    await db.boardAccess.deleteMany({
      where: { reportId: r.id, kind: "IMPORT" },
    });
    if (reason === "REUNITED" && r.kind === "FOUND" && claim) {
      const token = await access(r.id, claim.email, "IMPORT");
      const sent = await mail(
        claim.email,
        "Welcome your reunited pet to Petish",
        origin() + "/lost-found/reunited#" + token,
      );
      if (!sent)
        throw new HttpError(
          503,
          "Case closed, but the profile invitation email failed. Close as reunited again to retry.",
        );
    }
  } else if (action === "renew") {
    if (["HIDDEN", "PENDING"].includes(r.state))
      throw new HttpError(
        403,
        "Verify the report or contact a moderator before reopening.",
      );
    if (r.petId) {
      const p = await db.pet.findUnique({ where: { id: r.petId } });
      if (
        !p ||
        p.ownerId !== r.ownerId ||
        ["REHOMED", "DECEASED"].includes(p.status)
      )
        throw new HttpError(
          409,
          "This pet cannot have an active missing report.",
        );
    }
    r = await db.$transaction(async (tx) => {
      if (r!.petId) {
        await tx.$queryRaw`SELECT id FROM "Pet" WHERE id=${r!.petId}::uuid FOR UPDATE`;
        const currentPet = await tx.pet.findUnique({ where: { id: r!.petId } });
        if (
          !currentPet ||
          currentPet.ownerId !== r!.ownerId ||
          ["REHOMED", "DECEASED"].includes(currentPet.status)
        )
          throw new HttpError(
            409,
            "This pet cannot have an active missing report.",
          );
      }
      await tx.$queryRaw`SELECT id FROM "BoardReport" WHERE id=${r!.id}::uuid FOR UPDATE`;
      const currentReport = await tx.boardReport.findUniqueOrThrow({
        where: { id: r!.id },
      });
      if (["HIDDEN", "PENDING"].includes(currentReport.state))
        throw new HttpError(409, "This report cannot be reopened.");
      if (
        r!.petId &&
        (await tx.boardReport.count({
          where: { petId: r!.petId, state: "OPEN", id: { not: r!.id } },
        }))
      )
        throw new HttpError(409, "Another missing report is already active.");
      await tx.boardAccess.deleteMany({
        where: { reportId: r!.id, kind: "IMPORT" },
      });
      return tx.boardReport.update({
        where: { id: r!.id },
        data: {
          state: "OPEN",
          confirmedAt: new Date(),
          remindedAt: null,
          closedAt: null,
          closureReason: null,
        },
      });
    });
  } else if (action === "update") {
    const patch = z
      .object({
        details: z.string().trim().min(10).max(2000),
        locality: z.string().trim().min(2).max(160),
        phone: text(40),
        publicPhone: z.boolean(),
        reward: text(160),
      })
      .parse(body);
    if (r.kind === "MISSING" && (!patch.phone || !patch.publicPhone))
      throw new HttpError(
        400,
        "Missing reports require a public contact number.",
      );
    r = await db.boardReport.update({ where: { id: r.id }, data: patch });
  } else if (action !== "view") throw new HttpError(400, "Unknown action.");
  return {
    ...r,
    email: undefined,
    responses: await db.boardResponse.findMany({
      where: { reportId: r.id, verified: true },
      include: { photos: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    photos: await db.boardPhoto.findMany({
      where: { reportId: r.id, responseId: null },
      select: { id: true },
    }),
  };
}
export async function verifyResponse(token: unknown) {
  const a = await tokenAccess(token);
  if (!a || a.kind !== "RESPONSE" || !a.responseId)
    throw new HttpError(404, "Verification link expired or unavailable.");
  const r = await db.boardReport.findUniqueOrThrow({
    where: { id: a.reportId },
  });
  if (!(await visible(r)))
    throw new HttpError(404, "The report is no longer open.");
  const changed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BoardReport" WHERE id=${r.id}::uuid FOR UPDATE`;
    const current = await tx.boardReport.findUniqueOrThrow({
      where: { id: r.id },
    });
    if (
      current.state !== "OPEN" ||
      +current.confirmedAt < Date.now() - 60 * day
    )
      throw new HttpError(404, "The report is no longer open.");
    const result = await tx.boardResponse.updateMany({
      where: { id: a.responseId!, verified: false },
      data: { verified: true },
    });
    if (result.count)
      await tx.boardNotification.create({
        data: { id: a.responseId!, ...notificationData(r, responseSubject(r)) },
      });
    return result;
  });
  if (changed.count)
    await notify(
      r,
      r.kind === "MISSING"
        ? "A possible pet sighting was submitted"
        : "Someone thinks this may be their pet",
      a.responseId,
    );
  return {
    message: "Response verified. The report manager has been notified.",
  };
}
export async function requestLinks(emailInput: unknown) {
  const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .parse(emailInput)
    .toLowerCase();
  await rate(`links:${email}`, 3);
  await rate("all-links", 100);
  const reports = await db.boardReport.findMany({
    where: { email, ownerId: null },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  for (const r of reports) {
    const token = await access(r.id, email, "MANAGE");
    await mail(
      email,
      "Manage your Petish report",
      origin() + "/lost-found/manage#" + token,
    );
  }
  const replies = await db.boardResponse.findMany({
    where: { email, verified: false, report: { state: "OPEN" } },
    take: 5,
  });
  for (const reply of replies) {
    const token = await access(reply.reportId, email, "RESPONSE", reply.id);
    await mail(
      email,
      "Verify your private Petish response",
      origin() + "/lost-found/verify#" + token,
    );
  }
  return {
    message:
      "If matching reports or unverified responses exist, management links have been sent. Check your inbox.",
  };
}
export async function photoResponse(
  id: string,
  v: Viewer | null,
  token?: unknown,
) {
  const p = await db.boardPhoto.findUnique({
    where: { id },
    include: { report: true },
  });
  if (!p) throw new HttpError(404, "Photo unavailable.");
  const manager = await canManage(p.report, v, token);
  const a = await tokenAccess(token);
  const importer =
    !!a &&
    a.kind === "IMPORT" &&
    p.responseId === null &&
    a.reportId === p.reportId &&
    v?.email.toLowerCase() === a.email;
  if (
    !manager &&
    !moderator(v) &&
    !importer &&
    (p.responseId || !(await visible(p.report)))
  )
    throw new HttpError(404, "Photo unavailable.");
  return new Response(new Uint8Array(await getObject(p.thumbKey)), {
    headers: { ...boardHeaders, "Content-Type": "image/webp" },
  });
}
export async function importReport(
  v: Viewer | null,
  body: Record<string, unknown>,
) {
  if (!v)
    throw new HttpError(
      401,
      "Sign in or register with the email that received the reunion invitation.",
    );
  const a = await tokenAccess(body.token);
  if (!a || a.kind !== "IMPORT" || a.email !== v.email.toLowerCase())
    throw new HttpError(
      404,
      "This invitation is not available to this account.",
    );
  const r = await db.boardReport.findUniqueOrThrow({
    where: { id: a.reportId },
  });
  if (
    r.kind !== "FOUND" ||
    r.state !== "CLOSED" ||
    r.closureReason !== "REUNITED"
  )
    throw new HttpError(409, "The case must be closed as reunited first.");
  if (body.action === "preview")
    return {
      id: r.id,
      species: r.species,
      breed: r.breed,
      colour: r.colour,
      photoReuse: r.photoReuse,
      importedPetId: r.importedPetId,
    };
  const name = z.string().trim().min(1).max(60).parse(body.name);
  if (body.confirm !== true)
    throw new HttpError(
      400,
      "Confirm that you are the owner and have reviewed these details.",
    );
  const pet = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BoardReport" WHERE id=${r.id}::uuid FOR UPDATE`;
    const current = await tx.boardReport.findUniqueOrThrow({
      where: { id: r.id },
    });
    if (current.state !== "CLOSED" || current.closureReason !== "REUNITED")
      throw new HttpError(409, "The report is no longer closed as reunited.");
    if (current.importedPetId) {
      const existing = await tx.pet.findFirst({
        where: { id: current.importedPetId, ownerId: v.id },
      });
      if (!existing)
        throw new HttpError(409, "This report was already linked.");
      return existing;
    }
    const p = body.petId
      ? await tx.pet.findFirst({
          where: { id: String(body.petId), ownerId: v.id },
        })
      : await tx.pet.create({
          data: {
            name,
            species: r.species as "CAT" | "DOG",
            breed: r.breed,
            colour: r.colour,
            ownerId: v.id,
            ownerships: { create: { ownerId: v.id } },
          },
        });
    if (!p) throw new HttpError(404, "Choose a pet you own.");
    await tx.boardReport.update({
      where: { id: r.id },
      data: { importedPetId: p.id },
    });
    return p;
  });
  let copied = 0;
  if (body.copyPhotos === true && r.photoReuse) {
    const current = await db.petImage.count({ where: { petId: pet.id } });
    if (current === 0) {
      for (const p of await db.boardPhoto.findMany({
        where: { reportId: r.id, responseId: null },
      })) {
        try {
          await uploadPhoto(
            v.id,
            pet.id,
            new File(
              [new Uint8Array(await getObject(p.objectKey))],
              "reunited.webp",
              { type: "image/webp" },
            ),
            "UNSPECIFIED",
          );
          copied++;
        } catch {
          break;
        }
      }
    }
  }
  return {
    petId: pet.id,
    message: body.copyPhotos
      ? `${copied} photos copied. Review the profile and add any remaining photos manually.`
      : "Pet profile ready. Photos were not copied.",
  };
}
export async function maintainBoard() {
  const now = new Date();
  await db.boardReport.updateMany({
    where: { state: "OPEN", confirmedAt: { lt: new Date(+now - 60 * day) } },
    data: { state: "ARCHIVED" },
  });
  for (const r of await db.boardReport.findMany({
    where: {
      state: "OPEN",
      confirmedAt: { lt: new Date(+now - 30 * day) },
      remindedAt: null,
    },
    take: 100,
  })) {
    await db.$transaction(async (tx) => {
      const changed = await tx.boardReport.updateMany({
        where: {
          id: r.id,
          state: "OPEN",
          remindedAt: null,
          confirmedAt: r.confirmedAt,
        },
        data: { remindedAt: now },
      });
      if (changed.count)
        await tx.boardNotification.create({
          data: notificationData(
            r,
            "Is your Petish lost or found report still active?",
          ),
        });
    });
  }
  for (const n of await db.boardNotification.findMany({
    where: { sentAt: null, attempts: { lt: 5 } },
    take: 100,
  })) {
    const sent = await mail(
      n.email,
      n.subject,
      origin() + "/lost-found/manage",
    );
    await db.boardNotification.update({
      where: { id: n.id },
      data: { attempts: { increment: 1 }, sentAt: sent ? new Date() : null },
    });
  }
  await db.boardRate.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.boardAccess.deleteMany({ where: { expiresAt: { lt: now } } });
}
