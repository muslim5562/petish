import type { Metadata } from "next";
import SharedSummary from "@/components/shared-summary";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Protected health summary · Petish",
  description: "An owner-selected, protected health-summary snapshot.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};
export default function Page() {
  return <SharedSummary />;
}
