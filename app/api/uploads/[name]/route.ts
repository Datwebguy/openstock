import { NextResponse } from "next/server";
import { readRaw } from "@/lib/json-store";
import { UPLOAD_FILENAME } from "@/lib/safe-image-url";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!UPLOAD_FILENAME.test(name)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const encoded = await readRaw("upload:" + name);
    if (!encoded) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(Buffer.from(encoded, "base64"), {
      headers: { "Content-Type": TYPES[extension] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });
  }
}
