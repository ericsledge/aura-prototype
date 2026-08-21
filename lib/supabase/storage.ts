"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "scan-photos";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const contentType = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** Uploads one photo to the user's private folder and returns its storage path. */
export async function uploadScanPhoto(userId: string, scanId: string, viewType: string, dataUrl: string): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${scanId}/${viewType}.jpg`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`photo_upload_failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for displaying a private photo. */
export async function getSignedPhotoUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`signed_url_failed: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteScanPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`photo_delete_failed: ${error.message}`);
}
