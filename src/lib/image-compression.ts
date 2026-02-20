import {
  MAX_UPLOAD_BYTES,
  TARGET_UPLOAD_BYTES,
} from "@/lib/image-upload";

const MAX_DIMENSION = 1920;
const INITIAL_QUALITY = 0.86;
const MIN_QUALITY = 0.6;
const QUALITY_STEP = 0.08;

const COMPRESSIBLE_IMAGE_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
]);

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function buildFileName(name: string, contentType: string): string {
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? "jpg";
  const baseName = name.replace(/\.[^/.]+$/, "") || "upload";
  return `${baseName}.${ext}`;
}

function getOutputType(inputType: string): string {
  if (inputType === "image/png") {
    return "image/webp";
  }
  return "image/jpeg";
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image"));
    };
    img.src = objectUrl;
  });
}

function getScaledDimensions(width: number, height: number): {
  width: number;
  height: number;
} {
  const longestSide = Math.max(width, height);
  if (longestSide <= MAX_DIMENSION) {
    return { width, height };
  }
  const scale = MAX_DIMENSION / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Failed to encode image"));
      },
      type,
      quality,
    );
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const { width, height } = getScaledDimensions(originalWidth, originalHeight);

  const needsResize = width !== originalWidth || height !== originalHeight;
  if (!needsResize && file.size <= TARGET_UPLOAD_BYTES) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = getOutputType(file.type);
  let quality = INITIAL_QUALITY;
  let blob = await encodeCanvas(canvas, outputType, quality);

  while (blob.size > TARGET_UPLOAD_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    blob = await encodeCanvas(canvas, outputType, quality);
  }

  const encodedType = blob.type || outputType;
  const compressedFile = new File(
    [blob],
    buildFileName(file.name, encodedType),
    {
      type: encodedType,
      lastModified: Date.now(),
    },
  );

  if (compressedFile.size >= file.size && file.size <= MAX_UPLOAD_BYTES) {
    return file;
  }

  return compressedFile;
}
