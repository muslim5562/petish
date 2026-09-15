import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { json } from "@/lib/http";
export async function GET(req: Request) {
  if (process.env.PETISH_PHONE_PREVIEW === "true")
    return new Response(null, { status: 404 });
  const url = new URL(req.url);
  if (
    process.env.PETISH_DEMO !== "true" ||
    process.env.MAIL_MODE !== "local" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    return new Response(null, { status: 404 });
  const dir = path.join(process.cwd(), ".local", "mail");
  const files = await readdir(dir).catch(() => []);
  const messages = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 30)
      .map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8"))),
  );
  return json(messages);
}
