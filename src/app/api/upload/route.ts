import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/actions/_helpers";
import { uploadFile, generatePhotoKey } from "@/lib/storage";
import { checkRateLimit, getIpFromHeaders } from "@/lib/rate-limit";
import {
  ALLOWED_IMAGE_TYPES_LABEL,
  isAllowedImageType,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-upload";
import { guard } from "@/lib/abuse/guard";
import { resolveIdentityFromRaw } from "@/lib/abuse/identity";

const MAX_FILE_SIZE = MAX_UPLOAD_BYTES;

export async function POST(request: NextRequest) {
  const ip = getIpFromHeaders(request.headers);
  const rl = checkRateLimit("upload", ip);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Abuse guard (alongside existing rate limit as fallback)
  const deviceId = request.cookies.get("ik_did")?.value;
  const identity = resolveIdentityFromRaw({ userId: session.user.id, ip, deviceId });
  const abuseResult = await guard("upload.image", identity);
  if (abuseResult.decision === "deny" || abuseResult.decision === "throttle") {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES_LABEL}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 5MB." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = generatePhotoKey(file.type);
    await uploadFile(key, buffer, file.type);

    return NextResponse.json({ key });
  } catch (error) {
    console.error("[upload] Failed:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
