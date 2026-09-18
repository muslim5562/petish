import { Suspense } from "react";
import LostFound from "@/components/lost-found";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lost & Found | Petish",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return (
    <Suspense fallback={<main className="lf-main">Opening the board…</main>}>
      <LostFound />
    </Suspense>
  );
}
