import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate mime type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image (PNG, JPG, WebP, SVG)" }, { status: 400 });
    }

    // Limit file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image size must be under 5MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure public/uploads exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate safe unique filename
    const ext = path.extname(file.name) || ".png";
    const cleanExt = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext.toLowerCase()) ? ext.toLowerCase() : ".png";
    const filename = `token_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${cleanExt}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
    });
  } catch (err: unknown) {
    console.error("Image upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload image" },
      { status: 500 }
    );
  }
}
