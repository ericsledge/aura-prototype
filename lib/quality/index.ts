// Client-side capture-quality checks (Bible §92/§94, master spec "Quality check" screen).
// Runs in the browser against the actual uploaded file so bad inputs are rejected
// before we ever "score" them — real validation logic, not theater, even while the
// scoring/analysis step itself is mocked in Stage 3.

export interface ImageQualityResult {
  width: number;
  height: number;
  sizeBytes: number;
  avgBrightness: number; // 0-255
  sharpnessProxy: number; // higher = sharper; rough edge-energy estimate
  issues: string[];
  usable: boolean;
}

const MIN_DIMENSION = 480;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DARK_THRESHOLD = 40;
const BRIGHT_THRESHOLD = 235;
const SHARPNESS_THRESHOLD = 6;

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function analyzeImageFile(file: File): Promise<ImageQualityResult> {
  const issues: string[] = [];

  if (!SUPPORTED_TYPES.includes(file.type)) {
    issues.push("unsupported_format");
  }
  if (file.size > MAX_FILE_BYTES) {
    issues.push("file_too_large");
  }
  if (file.size < 8 * 1024) {
    issues.push("file_too_small");
  }

  const bitmap = await loadBitmap(file).catch(() => null);
  if (!bitmap) {
    return {
      width: 0,
      height: 0,
      sizeBytes: file.size,
      avgBrightness: 0,
      sharpnessProxy: 0,
      issues: [...issues, "corrupted_or_unreadable"],
      usable: false,
    };
  }

  const { width, height } = bitmap;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    issues.push("resolution_too_low");
  }

  const canvas = document.createElement("canvas");
  const sampleSize = 200;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      width,
      height,
      sizeBytes: file.size,
      avgBrightness: 0,
      sharpnessProxy: 0,
      issues: [...issues, "analysis_unavailable"],
      usable: issues.length === 0,
    };
  }
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  const gray = new Float32Array(sampleSize * sampleSize);
  let brightnessSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    brightnessSum += lum;
  }
  const avgBrightness = brightnessSum / gray.length;

  // Rough sharpness proxy: mean absolute Laplacian-ish gradient over the sampled grid.
  let edgeEnergy = 0;
  let edgeCount = 0;
  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const idx = y * sampleSize + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + sampleSize] - gray[idx - sampleSize];
      edgeEnergy += Math.abs(gx) + Math.abs(gy);
      edgeCount++;
    }
  }
  const sharpnessProxy = edgeEnergy / edgeCount;

  if (avgBrightness < DARK_THRESHOLD) issues.push("too_dark");
  if (avgBrightness > BRIGHT_THRESHOLD) issues.push("overexposed");
  if (sharpnessProxy < SHARPNESS_THRESHOLD) issues.push("blurry");

  bitmap.close();

  return {
    width,
    height,
    sizeBytes: file.size,
    avgBrightness,
    sharpnessProxy,
    issues,
    usable: issues.length === 0,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // Next.js 16's minimum supported browsers (Chrome/Edge 111+, Firefox 111+,
  // Safari 16.4+) all support createImageBitmap from a File — no fallback needed.
  return createImageBitmap(file);
}

export const QUALITY_ISSUE_LABELS: Record<string, string> = {
  unsupported_format: "Unsupported file format — use JPG, PNG, or WEBP.",
  file_too_large: "File is too large (max 15MB).",
  file_too_small: "File looks corrupted or empty.",
  corrupted_or_unreadable: "We couldn't read this image — try another file.",
  resolution_too_low: "Image resolution is too low — use at least 480px on each side.",
  too_dark: "Image is too dark — retake in better lighting.",
  overexposed: "Image is overexposed — reduce lighting or avoid direct flash.",
  blurry: "Image looks blurry — hold the camera steady and refocus.",
  analysis_unavailable: "Couldn't fully analyze this image, but it may still be usable.",
  duplicate_photo: "This looks identical to another photo you uploaded — use a distinct angle.",
};

export function fileHash(files: { name: string; size: number }[]): string {
  const raw = files.map((f) => `${f.name}:${f.size}`).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
