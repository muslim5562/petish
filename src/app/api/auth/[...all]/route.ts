import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
const handlers = toNextJsHandler(auth);
function allowed(req: Request) {
  return (
    process.env.PETISH_PHONE_PREVIEW !== "true" ||
    ["/api/auth/get-session", "/api/auth/sign-out"].includes(
      new URL(req.url).pathname,
    )
  );
}
export async function GET(req: Request) {
  return allowed(req) ? handlers.GET(req) : new Response(null, { status: 404 });
}
export async function POST(req: Request) {
  return allowed(req)
    ? handlers.POST(req)
    : new Response(null, { status: 404 });
}
