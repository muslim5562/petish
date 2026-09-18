import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./health.css";
import "./pwa.css";
import "./sharing.css";
import "./lost-found.css";
import PwaProvider from "@/components/pwa-provider";
export const metadata: Metadata = {
  title: "Petish · A little home for your pets",
  description:
    "Your pets, their stories, and the little details that make them special.",
  icons: {
    icon: "/favicon.svg",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: { capable: true, title: "Petish", statusBarStyle: "default" },
  applicationName: "Petish",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#38293f",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
