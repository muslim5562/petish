import { notFound } from "next/navigation";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { db } from "@/lib/db";
import { publicProjection, isPublicPet } from "@/lib/pet-rules";
import PublicCard from "@/components/public-card";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Meet a Petish pet",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const pet = await db.pet.findUnique({ where: { publicId: id } });
  if (!pet || !isPublicPet(pet)) notFound();
  return (
    <main className="public-page">
      <Link className="brand" href="/">
        <PawPrint />
        petish<span>®</span>
      </Link>
      <PublicCard pet={publicProjection(pet)} />
      <footer>
        Every pet has a story. <Link href="/">Give yours a little home.</Link>
        <br />
        <Link href="/credits">Photo credits</Link>
      </footer>
    </main>
  );
}
