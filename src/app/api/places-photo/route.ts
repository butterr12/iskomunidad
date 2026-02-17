import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const maxwidth = request.nextUrl.searchParams.get("maxwidth") || "800";

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

  const url = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${encodeURIComponent(ref)}&maxwidth=${encodeURIComponent(maxwidth)}&key=${apiKey}`;

  const response = await fetch(url);

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
      "Cache-Control": "public, max-age=86400",
    },
  });
}
