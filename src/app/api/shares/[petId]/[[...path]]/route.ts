import { sessionFor, checkOrigin, HttpError } from "@/lib/http";
import {
  previewSummary,
  createSummaryShare,
  listSummaryShares,
  ownerShareSnapshot,
  revokeSummaryShare,
} from "@/lib/shares";
import { limitedJson, shareJson, shareFailure } from "@/lib/share-http";
type Context = { params: Promise<{ petId: string; path?: string[] }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    if (path.length > 1) throw new HttpError(404, "Not found.");
    return shareJson(
      path[0]
        ? await ownerShareSnapshot(user.id, petId, path[0])
        : await listSummaryShares(user.id, petId),
    );
  } catch (e) {
    return shareFailure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    if (path.length !== 1 || !["preview", "create"].includes(path[0]))
      throw new HttpError(404, "Not found.");
    const body = await limitedJson(req);
    return shareJson(
      path[0] === "preview"
        ? await previewSummary(user.id, petId, body)
        : await createSummaryShare(user.id, petId, body),
      201,
    );
  } catch (e) {
    return shareFailure(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    const { user } = await sessionFor(req);
    const { petId, path = [] } = await ctx.params;
    if (path.length !== 1) throw new HttpError(404, "Not found.");
    return shareJson(await revokeSummaryShare(user.id, petId, path[0]));
  } catch (e) {
    return shareFailure(e);
  }
}
