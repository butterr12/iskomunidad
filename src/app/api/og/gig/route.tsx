import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gigListing } from "@/lib/schema";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/gigs";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fontCache = new Map<string, ArrayBuffer>();

async function loadFont(filename: string): Promise<ArrayBuffer> {
  const cached = fontCache.get(filename);
  if (cached) return cached;
  const fontPath = path.join(process.cwd(), "public", "fonts", filename);
  const buffer = await fs.readFile(fontPath);
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  fontCache.set(filename, ab);
  return ab;
}

async function getGigForOg(gigId: string) {
  return db.query.gigListing.findFirst({
    where: and(eq(gigListing.id, gigId), eq(gigListing.status, "approved")),
    columns: {
      title: true,
      description: true,
      category: true,
      compensation: true,
      urgency: true,
      applicantCount: true,
    },
    with: {
      user: { columns: { name: true, username: true } },
    },
  });
}

function getTitleSize(title: string): number {
  if (title.length < 60) return 72;
  if (title.length < 120) return 58;
  return 48;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3).trimEnd() + "...";
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return new Response("Invalid gig ID", { status: 400 });
  }

  try {
    const gig = await getGigForOg(id);

    if (!gig) {
      return new Response("Gig not found", { status: 404 });
    }

    const [cabinetFont, satoshiFont] = await Promise.all([
      loadFont("CabinetGrotesk-Extrabold.ttf"),
      loadFont("Satoshi-Bold.ttf"),
    ]);

    const categoryLabel = CATEGORY_LABELS[gig.category as keyof typeof CATEGORY_LABELS] ?? gig.category;
    const badgeColor = CATEGORY_COLORS[gig.category as keyof typeof CATEGORY_COLORS] ?? "#8b1a1a";
    const titleSize = getTitleSize(gig.title);
    const displayTitle = truncate(gig.title, 120);
    const displayBody = truncate(gig.description, 160);
    const authorName = gig.user?.name ?? "Anonymous";
    const authorHandle = gig.user?.username ? `@${gig.user.username}` : "";

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            background: "#111010",
            padding: "60px",
            position: "relative",
            overflow: "hidden",
            fontFamily: "Satoshi",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Category badge */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  background: `${badgeColor}22`,
                  border: `2px solid ${badgeColor}`,
                  fontSize: "26px",
                  fontFamily: "Satoshi",
                  fontWeight: 700,
                  color: badgeColor,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                }}
              >
                {categoryLabel}
              </div>
            </div>

            {/* Title */}
            <div
              style={{
                display: "flex",
                marginTop: "28px",
                fontSize: `${titleSize}px`,
                fontFamily: "Cabinet Grotesk",
                fontWeight: 800,
                color: "#f0f0f0",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              {displayTitle}
            </div>

            {/* Compensation + description */}
            <div
              style={{
                display: "flex",
                marginTop: "20px",
                fontSize: "32px",
                fontFamily: "Satoshi",
                fontWeight: 700,
                color: "#888888",
                lineHeight: 1.4,
              }}
            >
              {gig.compensation} · {displayBody}
            </div>

            <div style={{ display: "flex", marginTop: "32px", marginBottom: "28px" }}>
              <div
                style={{
                  width: "100px",
                  height: "3px",
                  background: `${badgeColor}66`,
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Author row */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "50%",
                  background: "#8b1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ fontSize: "30px", fontWeight: 700, color: "#e0e0e0" }}>
                  {authorName}
                </span>
                {authorHandle && (
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "#777777" }}>
                    {authorHandle}
                  </span>
                )}
              </div>
            </div>

            {/* Applicant count */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "16px",
                fontSize: "28px",
                color: "#888888",
                fontWeight: 700,
              }}
            >
              <span>{gig.applicantCount} {gig.applicantCount === 1 ? "applicant" : "applicants"}</span>
            </div>
          </div>

          {/* Bottom brand bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: "auto",
            }}
          >
            <span
              style={{
                fontSize: "32px",
                fontFamily: "Cabinet Grotesk",
                fontWeight: 800,
                color: "#8b1a1a",
              }}
            >
              iskomunidad
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Cabinet Grotesk", data: cabinetFont, weight: 800 as const, style: "normal" as const },
          { name: "Satoshi", data: satoshiFont, weight: 700 as const, style: "normal" as const },
        ],
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}
