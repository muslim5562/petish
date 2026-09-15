import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { isPublicPet } from "@/lib/pet-rules";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new Response(null, { status: 404, headers });
  const image = await db.petImage.findUnique({
    where: { id },
    include: { pet: true },
  });
  if (!image) return new Response(null, { status: 404, headers });
  const url = new URL(req.url);
  const publicRequest = url.searchParams.get("public") === "1";
  if (publicRequest) {
    if (!isPublicPet(image.pet) || image.pet.mainImageId !== id)
      return new Response(null, { status: 404, headers });
  } else {
    const s = await auth.api.getSession({ headers: req.headers });
    if (!s?.user.emailVerified || s.user.id !== image.pet.ownerId)
      return new Response(null, { status: 404, headers });
  }
  try {
    const file = await getObject(
      url.searchParams.get("size") === "thumb"
        ? image.thumbKey
        : image.objectKey,
    );
    return new Response(new Uint8Array(file), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
