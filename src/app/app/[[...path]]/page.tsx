import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PetishApp from "@/components/petish-app";
export const dynamic = "force-dynamic";
export default async function OwnerPage() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user.emailVerified) redirect("/login");
  return (
    <PetishApp
      user={{ id: s.user.id, name: s.user.name, email: s.user.email }}
      demo={process.env.PETISH_DEMO === "true"}
      phonePreview={process.env.PETISH_PHONE_PREVIEW === "true"}
    />
  );
}
