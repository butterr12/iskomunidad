import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const s3Key = key.join("/");

  if (!s3Key.startsWith("photos/")) {
    return NextResponse.json(
      { error: "Invalid photo key" },
      { status: 400 },
    );
  }

  try {
    const url = await getPresignedUrl(s3Key);
    return NextResponse.redirect(url, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[photos] Failed to generate presigned URL:", error);
    return NextResponse.json(
      { error: "Photo not found" },
      { status: 404 },
    );
  }
}
