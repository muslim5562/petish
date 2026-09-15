import Link from "next/link";
import { PawPrint } from "lucide-react";
export default function NotFound() {
  return (
    <main className="standalone empty">
      <PawPrint size={56} />
      <h1>This page isn’t available.</h1>
      <p>It may be private, or the link may no longer be active.</p>
      <Link href="/" className="button primary">
        Back to Petish
      </Link>
    </main>
  );
}
