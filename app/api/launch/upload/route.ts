import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { publicStoreError, writeRaw } from "@/lib/json-store";

// Kept under 1MB so a single upload fits one Upstash Redis request.
const MAX_BYTES = 1024 * 1024;
const WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 8;
const recentUploads = new Map<string, number[]>();

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function rateLimited(key: string) {
  const now = Date.now();
  const stamps = (recentUploads.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (stamps.length >= MAX_UPLOADS_PER_WINDOW) {
    recentUploads.set(key, stamps);
    return true;
  }
  stamps.push(now);
  recentUploads.set(key, stamps);
  return false;
}

function imageExtension(buffer: Buffer): ".png" | ".jpg" | ".webp" | ".gif" | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return ".png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") return ".gif";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (rateLimited(clientKey(request))) {
      return NextResponse.json({ error: "Too many uploads. Wait a moment and try again." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image size must be under 1MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = imageExtension(buffer);
    if (!ext) {
      return NextResponse.json({ error: "File must be a PNG, JPG, WebP, or GIF image." }, { status: 400 });
    }

    const filename = `token_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    await writeRaw("upload:" + filename, buffer.toString("base64"));

    return NextResponse.json({
      success: true,
      url: `/api/uploads/${filename}`,
      filename,
      size: buffer.length,
    });
  } catch (error) {
    return NextResponse.json({ error: publicStoreError(error, "Failed to upload image") }, { status: 500 });
  }
}
