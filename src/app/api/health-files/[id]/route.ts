import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getObject } from "@/lib/storage";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  const deny = () => new Response(null, { status: 404, headers });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return deny();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user.emailVerified) return deny();
  const file = await db.attachment.findFirst({
    where: {
      id,
      deletedAt: null,
      record: { deletedAt: null, pet: { ownerId: session.user.id } },
    },
  });
  if (!file) return deny();
  try {
    const data = await getObject(
      new URL(req.url).searchParams.get("thumb") === "1" && file.thumbKey
        ? file.thumbKey
        : file.objectKey,
    );
    return new Response(new Uint8Array(data), {
      headers: {
        ...headers,
        "Content-Type": file.mime,
        "Content-Disposition": `${file.mime === "application/pdf" ? "attachment" : "inline"}; filename="document.${file.mime === "application/pdf" ? "pdf" : "webp"}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      },
    });
  } catch {
    return deny();
  }
}
