import { db } from "@/lib/db";
import { checkOrigin, HttpError } from "@/lib/http";
import { ZodError } from "zod";
import {
  boardHeaders,
  viewer,
  moderator,
  rate,
  limitedBody,
  visible,
  publicReport,
  createReport,
  respond,
  manage,
  verifyResponse,
  requestLinks,
  photoResponse,
  importReport,
  tokenAccess,
} from "@/lib/board";
type Context = { params: Promise<{ path?: string[] }> };
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: boardHeaders });
function failure(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  if (e instanceof ZodError)
    return json({ error: e.issues[0]?.message || "Check your details." }, 400);
  return json(
    { error: "Could not complete this request. Please try again." },
    500,
  );
}
function validId(s: string) {
  if (!/^[a-f0-9-]{36}$/.test(s)) throw new HttpError(404, "Not found.");
}
export async function GET(req: Request, ctx: Context) {
  try {
    const p = (await ctx.params).path || [];
    const url = new URL(req.url);
    const v = await viewer(req);
    if (p[0] === "meta")
      return json({
        user: v ? { id: v.id, email: v.email } : null,
        moderator: moderator(v),
        guestEmailAvailable: process.env.PETISH_PHONE_PREVIEW !== "true",
        localMail:
          process.env.PETISH_DEMO === "true" &&
          process.env.MAIL_MODE === "local" &&
          ["127.0.0.1", "localhost"].includes(url.hostname),
        unread: v
          ? await db.boardNotification.count({
              where: { ownerId: v.id, readAt: null },
            })
          : 0,
      });
    if (p[0] === "mine") {
      if (!v) throw new HttpError(401, "Sign in to view your reports.");
      return json({
        reports: await db.boardReport.findMany({
          where: { ownerId: v.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            kind: true,
            state: true,
            petName: true,
            species: true,
            breed: true,
            occurredAt: true,
            custody: true,
            locality: true,
            createdAt: true,
            closureReason: true,
            confirmedAt: true,
          },
        }),
        notifications: await db.boardNotification.findMany({
          where: { ownerId: v.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            reportId: true,
            subject: true,
            readAt: true,
            createdAt: true,
          },
        }),
      });
    }
    if (p[0] === "moderation") {
      if (!moderator(v)) throw new HttpError(403, "Moderator access required.");
      return json({
        flags: await db.boardFlag.findMany({
          where: { state: "OPEN" },
          include: { report: true },
          orderBy: { createdAt: "asc" },
          take: 100,
        }),
        reports: await db.boardReport.findMany({
          where: { state: { in: ["OPEN", "HIDDEN"] } },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            photos: { where: { responseId: null }, select: { id: true } },
          },
        }),
      });
    }
    if (p[0] === "photos" && p.length === 2) {
      validId(p[1]);
      return await photoResponse(p[1], v);
    }
    if (p.length === 1) {
      validId(p[0]);
      const r = await db.boardReport.findUnique({ where: { id: p[0] } });
      if (!r || !(await visible(r)))
        return json(
          {
            closed: true,
            message:
              "This report is closed or unavailable. Its photos and contact details are no longer public.",
          },
          404,
        );
      return json(await publicReport(r, true));
    }
    if (p.length) throw new HttpError(404, "Not found.");
    const kind = url.searchParams.get("kind"),
      species = url.searchParams.get("species"),
      q = (url.searchParams.get("q") || "").slice(0, 160),
      custody = url.searchParams.get("custody"),
      since = url.searchParams.get("since"),
      cursor = url.searchParams.get("cursor");
    if (cursor) validId(cursor);
    const rows = await db.boardReport.findMany({
      where: {
        state: "OPEN",
        confirmedAt: { gte: new Date(Date.now() - 60 * 86400000) },
        ...(kind && ["MISSING", "FOUND"].includes(kind) ? { kind } : {}),
        ...(species && ["CAT", "DOG"].includes(species) ? { species } : {}),
        ...(custody && ["IN_CARE", "ROAMING"].includes(custody)
          ? { custody }
          : {}),
        ...(since &&
        /^\d{4}-\d{2}-\d{2}$/.test(since) &&
        Number.isFinite(+new Date(since))
          ? { occurredAt: { gte: new Date(since) } }
          : {}),
        ...(q
          ? {
              OR: [
                { locality: { contains: q, mode: "insensitive" as const } },
                { petName: { contains: q, mode: "insensitive" as const } },
                { colour: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const reports = [];
    for (const r of rows)
      if (await visible(r)) reports.push(await publicReport(r));
    return json({
      reports,
      nextCursor: rows.length === 25 ? rows.at(-1)!.id : null,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const p = (await ctx.params).path || [];
    const v = await viewer(req);
    if (!p.length) return json(await createReport(req, v), 201);
    if (p.length === 2 && p[1] === "responses") {
      validId(p[0]);
      return json(await respond(req, p[0], v), 201);
    }
    const body = (await (await limitedBody(req, 32768)).json()) as Record<
      string,
      unknown
    >;
    if (p[0] === "photos" && p.length === 2) {
      validId(p[1]);
      return await photoResponse(p[1], v, body.token);
    }
    if (p.length !== 1) throw new HttpError(404, "Not found.");
    if (p[0] === "manage") return json(await manage(req, v, body));
    if (p[0] === "verify") return json(await verifyResponse(body.token));
    if (p[0] === "request-link") return json(await requestLinks(body.email));
    if (p[0] === "import") return json(await importReport(v, body));
    if (p[0] === "notifications") {
      if (!v) throw new HttpError(401, "Sign in first.");
      await db.boardNotification.updateMany({
        where: { ownerId: v.id, readAt: null },
        data: { readAt: new Date() },
      });
      return json({ ok: true });
    }
    if (p[0] === "flag") {
      await rate("all-flags", 100);
      const id = String(body.id || "");
      validId(id);
      if (body.website) throw new HttpError(400, "Submission rejected.");
      const reason = String(body.reason || "").trim();
      if (reason.length < 10 || reason.length > 1000)
        throw new HttpError(
          400,
          "Describe the concern in 10 to 1000 characters.",
        );
      const r = await db.boardReport.findUnique({ where: { id } });
      if (!r || !(await visible(r)))
        throw new HttpError(404, "Report unavailable.");
      await db.boardFlag.create({ data: { reportId: id, reason } });
      return json({
        message: "Your concern has been added to the moderator review queue.",
      });
    }
    if (p[0] === "moderation") {
      if (!moderator(v)) throw new HttpError(403, "Moderator access required.");
      const id = String(body.id || "");
      validId(id);
      if (body.action === "dismiss") {
        await db.boardFlag.update({
          where: { id },
          data: { state: "DISMISSED" },
        });
      } else if (body.action === "hide" || body.action === "restore") {
        const r = await db.boardReport.findUniqueOrThrow({ where: { id } });
        if (body.action === "hide" && !["OPEN", "HIDDEN"].includes(r.state))
          throw new HttpError(409, "Only open reports can be hidden.");
        if (body.action === "restore" && r.state !== "HIDDEN")
          throw new HttpError(409, "Only hidden reports can be restored.");
        await db.boardReport.update({
          where: { id },
          data: {
            state:
              body.action === "hide"
                ? "HIDDEN"
                : r.closedAt
                  ? "CLOSED"
                  : "OPEN",
          },
        });
        await db.auditLog.create({
          data: {
            actorId: v!.id,
            action: `Lost & Found ${body.action}: ${id}`,
          },
        });
      } else throw new HttpError(400, "Unknown moderation action.");
      return json({ ok: true });
    }
    if (p[0] === "invitation") {
      const a = await tokenAccess(body.token);
      return json({ valid: !!a });
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    return failure(e);
  }
}
