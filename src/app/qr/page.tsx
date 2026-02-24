import type { Metadata } from "next";
import QRCode from "qrcode";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "QR Code",
  robots: { index: false, follow: false },
};

export default async function QrPage() {
  const svg = await QRCode.toString(siteConfig.url, {
    type: "svg",
    width: 320,
    margin: 2,
    color: {
      dark: "#111010",
      light: "#ffffff",
    },
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-white p-8">
      <div className="flex flex-col items-center gap-6">
        {/* Brand */}
        <div className="text-center">
          <p className="font-cabinet-grotesk text-3xl font-extrabold tracking-tight text-[#8b1a1a]">
            iskomunidad
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            The community app for UP campuses
          </p>
        </div>

        {/* QR code */}
        <div
          className="rounded-2xl border border-neutral-200 p-4 shadow-sm"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        {/* URL label */}
        <p className="text-xs font-mono text-neutral-400">{siteConfig.url}</p>

        {/* Download */}
        <a
          href="/api/qr"
          download="iskomunidad-qr.png"
          className="rounded-lg bg-[#8b1a1a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Download PNG
        </a>
      </div>
    </main>
  );
}
