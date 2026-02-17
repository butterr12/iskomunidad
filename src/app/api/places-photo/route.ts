import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const maxwidthParam = request.nextUrl.searchParams.get("maxwidth");

  if (!ref) {
    return NextResponse.json(
      { error: "Missing ref parameter" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const parsedMaxWidth = maxwidthParam ? Number(maxwidthParam) : 800;
  const maxwidth = Number.isFinite(parsedMaxWidth)
    ? Math.min(Math.max(Math.round(parsedMaxWidth), 200), 1600)
    : 800;

  const url = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${encodeURIComponent(ref)}&maxwidth=${maxwidth}&key=${apiKey}`;

  const response = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: response.status },
    );
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const body = await response.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
    },
  });
}
