import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

export async function GET() {
  const buffer = await QRCode.toBuffer(siteConfig.url, {
    type: "png",
    width: 800,
    margin: 2,
    color: {
      dark: "#111010",
      light: "#ffffff",
    },
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": 'attachment; filename="iskomunidad-qr.png"',
    },
  });
}
