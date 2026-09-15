import { auth } from "./auth";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function sessionFor(request: Request) {
  const s = await auth.api.getSession({ headers: request.headers });
  if (!s || !s.user.emailVerified)
    throw new HttpError(401, "Please sign in to continue.");
  return s;
}
export function checkOrigin(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL!).origin
  )
    throw new HttpError(403, "This request could not be verified.");
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      { error: error.issues[0]?.message || "Check your entries." },
      400,
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return json({ error: "Something went wrong. Please try again." }, 500);
}
