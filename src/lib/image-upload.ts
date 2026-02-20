export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const TARGET_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_BYTES * 0.9);

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_IMAGE_TYPES_LABEL = "JPEG, PNG, WebP, GIF";
export const IMAGE_UPLOAD_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

const ALLOWED_IMAGE_TYPE_SET = new Set<string>(ALLOWED_IMAGE_TYPES);

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPE_SET.has(type);
}
