import { auth } from "@/lib/auth";
import { checkOrigin, failure } from "@/lib/http";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (
      process.env.PETISH_DEMO !== "true" ||
      (!["localhost", "127.0.0.1"].includes(new URL(req.url).hostname) &&
        !(
          process.env.PETISH_PHONE_PREVIEW === "true" &&
          new URL(req.url).origin === process.env.BETTER_AUTH_URL
        ))
    )
      return new Response(null, { status: 404 });
    return auth.api.signInEmail({
      body: {
        email: "sarah@petish.test",
        password: process.env.DEMO_PASSWORD!,
      },
      headers: req.headers,
      asResponse: true,
    });
  } catch (e) {
    return failure(e);
  }
}
