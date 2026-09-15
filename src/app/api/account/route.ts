import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sessionFor, checkOrigin, json, failure, HttpError } from "@/lib/http";
import { z } from "zod";
export async function GET(req: Request) {
  try {
    const { user } = await sessionFor(req);
    return json({
      user,
      deletionRequest: await db.deletionRequest.findUnique({
        where: { userId: user.id },
      }),
      activity: await db.auditLog.findMany({
        where: { actorId: user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { name } = z
      .object({ name: z.string().trim().min(1).max(80) })
      .parse(await req.json());
    await db.user.update({ where: { id: user.id }, data: { name } });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { password, cancel } = z
      .object({ password: z.string().min(1), cancel: z.boolean().optional() })
      .parse(await req.json());
    try {
      const verified = await auth.api.verifyPassword({
        body: { password },
        headers: req.headers,
      });
      if (!verified.status) throw new Error("Incorrect");
    } catch {
      throw new HttpError(400, "The password is incorrect.");
    }
    if (cancel) {
      await db.deletionRequest.deleteMany({ where: { userId: user.id } });
      return json({ ok: true });
    }
    await db.deletionRequest.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: { status: "REQUESTED", requestedAt: new Date() },
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
