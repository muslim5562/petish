import { z } from "zod";
import { checkOrigin } from "@/lib/http";
import { resolveSummaryShare, shareHeaders } from "@/lib/shares";
import { limitedJson, shareJson, shareFailure } from "@/lib/share-http";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { token } = z
      .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
      .strict()
      .parse(await limitedJson(req, 1024));
    return shareJson(await resolveSummaryShare(token));
  } catch (e) {
    return shareFailure(e);
  }
}
export async function GET() {
  return Response.json(
    { error: "This shared summary is not available." },
    { status: 404, headers: shareHeaders },
  );
}
