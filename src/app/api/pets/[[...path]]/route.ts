import { db } from "@/lib/db";
import { sessionFor, checkOrigin, json, failure, HttpError } from "@/lib/http";
import {
  ownedPet,
  savePet,
  setPetState,
  uploadPhoto,
  changePhoto,
  publicProjection,
} from "@/lib/pets";
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const { user } = await sessionFor(req);
    const [id, action] = (await ctx.params).path || [];
    if (!id)
      return json(
        await db.pet.findMany({
          where: { ownerId: user.id },
          include: { images: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "asc" },
        }),
      );
    const pet = await ownedPet(user.id, id);
    return json(action === "preview" ? publicProjection(pet) : pet);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const [id, action] = (await ctx.params).path || [];
    if (!id) return json(await savePet(user.id, await req.json()), 201);
    if (action === "photos") {
      if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024)
        throw new HttpError(413, "Choose an image up to 10 MB.");
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "Choose a photo.");
      return json(
        await uploadPhoto(
          user.id,
          id,
          file,
          String(form.get("view") || "UNSPECIFIED"),
          String(form.get("replaceId") || "") || undefined,
        ),
        201,
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
    const [id, action, imageId] = (await ctx.params).path || [];
    if (!id) throw new HttpError(404, "Not found.");
    if (action === "state")
      return json(await setPetState(user.id, id, await req.json()));
    if (action === "photos" && imageId) {
      await changePhoto(user.id, id, imageId, false);
      return json({ ok: true });
    }
    return json(await savePet(user.id, await req.json(), id));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const [id, action, imageId] = (await ctx.params).path || [];
    if (action !== "photos" || !id || !imageId)
      throw new HttpError(404, "Not found.");
    await changePhoto(user.id, id, imageId, true);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
