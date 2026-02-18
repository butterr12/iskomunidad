import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/actions/_helpers";
import { uploadFile, generatePhotoKey } from "@/lib/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
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
