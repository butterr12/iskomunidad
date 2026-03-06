import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campusEvent } from "@/lib/schema";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS } from "@/lib/events";
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

async function getEventForOg(eventId: string) {
  return db.query.campusEvent.findFirst({
    where: and(eq(campusEvent.id, eventId), eq(campusEvent.status, "approved")),
    columns: {
      title: true,
      description: true,
      category: true,
      organizer: true,
      startDate: true,
      endDate: true,
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

function formatDateRange(startDate: Date, endDate: Date): string {
  const dateStr = startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime}–${endTime}`;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return new Response("Invalid event ID", { status: 400 });
  }

  try {
    const event = await getEventForOg(id);

    if (!event) {
      return new Response("Event not found", { status: 404 });
    }

    const [cabinetFont, satoshiFont] = await Promise.all([
      loadFont("CabinetGrotesk-Extrabold.ttf"),
      loadFont("Satoshi-Bold.ttf"),
    ]);

    const categoryLabel = EVENT_CATEGORY_LABELS[event.category as keyof typeof EVENT_CATEGORY_LABELS] ?? event.category;
    const badgeColor = EVENT_CATEGORY_COLORS[event.category as keyof typeof EVENT_CATEGORY_COLORS] ?? "#8b1a1a";
    const titleSize = getTitleSize(event.title);
    const displayTitle = truncate(event.title, 120);
    const dateSubtitle = formatDateRange(event.startDate, event.endDate);
    const authorName = event.user?.name ?? "Anonymous";
    const authorHandle = event.user?.username ? `@${event.user.username}` : "";

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

            {/* Date subtitle */}
            <div
              style={{
                display: "flex",
                marginTop: "20px",
                fontSize: "30px",
                fontFamily: "Satoshi",
                fontWeight: 700,
                color: "#888888",
                lineHeight: 1.4,
              }}
            >
              {dateSubtitle}
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

            {/* Author / organizer row */}
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
                  {event.organizer}
                </span>
                {authorHandle && (
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "#777777" }}>
                    {authorHandle}
                  </span>
                )}
              </div>
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
