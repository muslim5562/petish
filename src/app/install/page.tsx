import type { Metadata } from "next";
import InstallGuide from "@/components/install-guide";
export const metadata: Metadata = { title: "Install Petish on your phone" };
export default function Page() {
  return <InstallGuide />;
}
