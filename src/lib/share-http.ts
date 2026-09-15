import { ZodError } from "zod";
import { HttpError } from "./http";
import { shareHeaders } from "./shares";
export function shareJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: shareHeaders });
}
export function shareFailure(error: unknown) {
  if (error instanceof HttpError)
    return shareJson({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return shareJson(
      { error: error.issues[0]?.message || "Check your choices." },
      400,
    );
  return shareJson(
    { error: "Could not load or save this shared summary. Please try again." },
    500,
  );
}
export async function limitedJson(req: Request, limit = 32768) {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "This request is too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request.");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "This request is too large.");
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
