import { z } from "zod";
import { db } from "@/lib/db";
import { sessionFor, checkOrigin, json, failure, HttpError } from "@/lib/http";
import {
  healthData,
  healthRecordFor,
  saveHealthRecord,
  removeOrRestoreHealth,
  saveHealthContext,
} from "@/lib/health";
import {
  addHealthFile,
  removeHealthFile,
  limitedForm,
} from "@/lib/health-files";
type Context = { params: Promise<{ petId: string; path?: string[] }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    const [id, action] = path;
    if (path.length > 2 || (action && action !== "revisions"))
      throw new HttpError(404, "Not found.");
    if (!id) {
      const date =
        new URL(req.url).searchParams.get("today") ||
        new Date().toISOString().slice(0, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(new Date(date).getTime())
      )
        throw new HttpError(400, "Invalid date.");
      return json(await healthData(user.id, petId, date));
    }
    const record = await healthRecordFor(user.id, petId, id, true);
    if (action === "revisions")
      return json(
        await db.healthRevision.findMany({
          where: { recordId: record.id },
          orderBy: { version: "desc" },
        }),
      );
    return json(record);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    const [id, action] = path;
    if (path.length > 2) throw new HttpError(404, "Not found.");
    if (!id)
      return json(
        await saveHealthRecord(user.id, petId, await req.json()),
        201,
      );
    if (action === "files") {
      const form = await limitedForm(req);
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "Choose a file.");
      return json(
        await addHealthFile(
          user.id,
          petId,
          id,
          file,
          String(form.get("description") || ""),
        ),
        201,
      );
    }
    if (action === "restore") {
      const { version } = z
        .object({ version: z.number().int().positive() })
        .parse(await req.json());
      return json(
        await removeOrRestoreHealth(user.id, petId, id, version, true),
      );
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    if (path.length !== 1) throw new HttpError(404, "Not found.");
    const [id] = path;
    if (id === "context")
      return json(await saveHealthContext(user.id, petId, await req.json()));
    if (!id) throw new HttpError(404, "Not found.");
    return json(await saveHealthRecord(user.id, petId, await req.json(), id));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    const [id, action, fileId] = path;
    if (
      path.length !== 1 &&
      !(path.length === 3 && action === "files" && fileId)
    )
      throw new HttpError(404, "Not found.");
    if (!id) throw new HttpError(404, "Not found.");
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(await req.json());
    return json(
      action === "files" && fileId
        ? await removeHealthFile(user.id, petId, id, fileId, version)
        : await removeOrRestoreHealth(user.id, petId, id, version),
    );
  } catch (e) {
    return failure(e);
  }
}
