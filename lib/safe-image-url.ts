const UPLOAD_NAME = /^token_\d+_[a-f0-9]{8}\.(png|jpe?g|webp|gif)$/i;
const MAX_DATA_URI_CHARS = 2_000_000;

export const UPLOAD_FILENAME = UPLOAD_NAME;

export function resolvePublicImageUrl(imageUrl: unknown, origin: string): string | null {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) return null;

  const uploadPrefix = imageUrl.startsWith("/api/uploads/") ? "/api/uploads/" : imageUrl.startsWith("/uploads/") ? "/uploads/" : null;
  if (uploadPrefix) {
    const filename = imageUrl.slice(uploadPrefix.length);
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || !UPLOAD_NAME.test(filename)) {
      return null;
    }
    return `${origin.replace(/\/$/, "")}/api/uploads/${filename}`;
  }

  if (imageUrl.startsWith("data:image/")) {
    if (imageUrl.length > MAX_DATA_URI_CHARS) return null;
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageUrl.slice(0, 40))) return null;
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
