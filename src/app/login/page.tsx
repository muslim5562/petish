import { Suspense } from "react";
import PreviewLogin from "@/components/preview-login";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.PETISH_PHONE_PREVIEW === "true") return <PreviewLogin />;
  return (
    <Suspense fallback={<p className="loading">Getting things ready…</p>}>
      <Login demo={process.env.PETISH_DEMO === "true"} />
    </Suspense>
  );
}
