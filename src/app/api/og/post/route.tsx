import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityPost } from "@/lib/schema";
import { FLAIR_COLORS, type PostFlair } from "@/lib/posts";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Module-level font cache (survives across requests within the same process)
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

async function getPostForOg(postId: string) {
  return db.query.communityPost.findFirst({
    where: and(
      eq(communityPost.id, postId),
      eq(communityPost.status, "approved")
    ),
    columns: {
      title: true,
      flair: true,
      score: true,
      commentCount: true,
    },
    with: {
      user: { columns: { name: true, username: true } },
    },
  });
}

function getTitleSize(title: string): number {
  if (title.length < 80) return 52;
  if (title.length < 160) return 42;
  return 34;
}

function truncateTitle(title: string, maxChars = 120): string {
  if (title.length <= maxChars) return title;
  return title.slice(0, maxChars - 3).trimEnd() + "...";
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return new Response("Invalid post ID", { status: 400 });
  }

  try {
    const post = await getPostForOg(id);

    if (!post) {
      return new Response("Post not found", { status: 404 });
    }

    const [cabinetFont, satoshiFont] = await Promise.all([
      loadFont("CabinetGrotesk-Extrabold.ttf"),
      loadFont("Satoshi-Bold.ttf"),
    ]);

    const flair = post.flair as PostFlair;
    const flairColor = FLAIR_COLORS[flair] ?? "#8b1a1a";
    const titleSize = getTitleSize(post.title);
    const displayTitle = truncateTitle(post.title);
    const authorName = post.user?.name ?? "Anonymous";
    const authorHandle = post.user?.username
      ? `@${post.user.username}`
      : "";

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            background:
              "linear-gradient(145deg, #0f0808 0%, #1a0d0d 50%, #0d0d14 100%)",
            padding: "48px",
            position: "relative",
            overflow: "hidden",
            fontFamily: "Satoshi",
          }}
        >
          {/* Flair-colored glow circle */}
          <div
            style={{
              position: "absolute",
              top: "-60px",
              right: "-60px",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background: flairColor,
              opacity: 0.08,
            }}
          />
          {/* Brand accent circle */}
          <div
            style={{
              position: "absolute",
              bottom: "-30px",
              left: "80px",
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              background: "#8b1a1a",
              opacity: 0.06,
            }}
          />
          {/* Subtle border */}
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

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {/* Flair badge */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 16px",
                  borderRadius: "9999px",
                  background: `${flairColor}22`,
                  border: `1.5px solid ${flairColor}`,
                  fontSize: "16px",
                  fontFamily: "Satoshi",
                  fontWeight: 700,
                  color: flairColor,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                }}
              >
                {flair}
              </div>
            </div>

            {/* Post title */}
            <div
              style={{
                display: "flex",
                marginTop: "24px",
                fontSize: `${titleSize}px`,
                fontFamily: "Cabinet Grotesk",
                fontWeight: 800,
                color: "#f0f0f0",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {displayTitle}
            </div>

            {/* Separator */}
            <div
              style={{
                display: "flex",
                marginTop: "28px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "3px",
                  background: `${flairColor}66`,
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Author row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#8b1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#e0e0e0",
                  }}
                >
                  {authorName}
                </span>
                {authorHandle && (
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#777777",
                    }}
                  >
                    {authorHandle}
                  </span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "12px",
                fontSize: "18px",
                color: "#888888",
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4L3 15h6v5h6v-5h6L12 4z" fill="#888888" />
                </svg>
                <span>{post.score}</span>
              </div>
              <span style={{ color: "#555555" }}>{"\u00B7"}</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                    stroke="#888888"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {post.commentCount}{" "}
                  {post.commentCount === 1 ? "comment" : "comments"}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom brand bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect
                  x="16"
                  y="2"
                  width="8"
                  height="8"
                  rx="1"
                  transform="rotate(45 16 2)"
                  fill="#8b1a1a"
                />
                <rect x="12" y="14" width="8" height="16" rx="1" fill="#8b1a1a" />
              </svg>
              <span
                style={{
                  fontSize: "22px",
                  fontFamily: "Cabinet Grotesk",
                  fontWeight: 800,
                  color: "#8b1a1a",
                }}
              >
                iskomunidad
              </span>
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#555555",
              }}
            >
              university community
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Cabinet Grotesk",
            data: cabinetFont,
            weight: 800 as const,
            style: "normal" as const,
          },
          {
            name: "Satoshi",
            data: satoshiFont,
            weight: 700 as const,
            style: "normal" as const,
          },
        ],
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}
