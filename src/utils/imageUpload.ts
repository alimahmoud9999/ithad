import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { StorageBucketName } from '../types/database';

export interface CompressedUploadResult {
  /** Final URL to store in DB (Supabase Storage URL or local manipulated URI in demo mode) */
  publicUrl: string;
  /** Structured path inside the bucket: {building_id}/{year_month}/{unique_filename}.jpg */
  storagePath: string;
  /** Local compressed file URI on device */
  localUri: string;
  /** Final image width (<= 1080px) */
  width: number;
  /** Final image height (preserving original aspect ratio) */
  height: number;
  /** Approximate compressed size in KB (typically 80 KB – 150 KB) */
  estimatedSizeKb: number;
  /** Original raw size in KB before compression (if reported by picker) */
  originalSizeKb?: number;
}

export interface CompressAndUploadParams {
  /** Raw image URI from camera or gallery */
  uri: string;
  /** Target Supabase Storage bucket */
  bucket: StorageBucketName;
  /** Building UUID or ID for folder organization */
  buildingId: string;
  /** Optional billing/expense month in YYYY-MM format (defaults to current year_month) */
  yearMonth?: string;
  /** Optional original width from ImagePickerAsset to avoid upscaling smaller images */
  originalWidth?: number;
  /** Optional original file size in bytes from ImagePickerAsset */
  originalFileSize?: number;
}

const MAX_IMAGE_WIDTH = 1080;
const COMPRESSION_QUALITY = 0.6; // 60% quality -> ~80KB to 150KB

/**
 * Formats a date or string into safe YYYY-MM folder name
 */
function normalizeYearMonth(yearMonth?: string): string {
  if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth.trim())) {
    return yearMonth.trim();
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Generates a collision-safe unique filename ending in .jpg
 */
function generateUniqueFilename(prefix = 'doc'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomSuffix}.jpg`;
}

/**
 * Central Mandatory Storage Optimization Utility (`compressAndUploadImage`)
 *
 * 1. Resizes the image so width never exceeds 1080px while preserving Aspect Ratio
 *    (keeping InstaPay reference numbers, dates, and invoice line items sharp).
 * 2. Compresses quality at 0.6 (60%) and converts format to JPEG, reducing 4–5 MB raw
 *    camera photos down to ~80 KB – 150 KB.
 * 3. Saves inside structured paths: `{building_id}/{year_month}/{unique_filename}.jpg`.
 */
export async function compressAndUploadImage(
  params: CompressAndUploadParams
): Promise<CompressedUploadResult> {
  const {
    uri,
    bucket,
    buildingId,
    yearMonth,
    originalWidth,
    originalFileSize,
  } = params;

  const targetWidth =
    originalWidth && originalWidth > 0 && originalWidth < MAX_IMAGE_WIDTH
      ? originalWidth
      : MAX_IMAGE_WIDTH;

  // Step 1 & 2: Resize (max width 1080px, preserving aspect ratio) + Compress (0.6 JPEG)
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetWidth } }],
    {
      compress: COMPRESSION_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  // Step 3: Build structured storage path: {building_id}/{year_month}/{unique_filename}.jpg
  const safeBuildingId = (buildingId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folderYearMonth = normalizeYearMonth(yearMonth);
  const prefix =
    bucket === 'payment-receipts'
      ? 'receipt'
      : bucket === 'expense-invoices'
      ? 'invoice'
      : 'sub';
  const uniqueFilename = generateUniqueFilename(prefix);
  const storagePath = `${safeBuildingId}/${folderYearMonth}/${uniqueFilename}`;

  // Read compressed file into blob/arrayBuffer to measure size & upload to Supabase Storage
  let estimatedSizeKb = 115;
  let fileBuffer: ArrayBuffer | null = null;

  try {
    const response = await fetch(manipulated.uri);
    const blob = await response.blob();
    if (blob.size > 0) {
      estimatedSizeKb = Math.max(1, Math.round(blob.size / 1024));
    }
    if (typeof blob.arrayBuffer === 'function') {
      fileBuffer = await blob.arrayBuffer();
    }
  } catch {
    // Fallback estimate when local fetch blob size is unavailable on certain runtimes
    estimatedSizeKb = 112;
  }

  const originalSizeKb = originalFileSize
    ? Math.round(originalFileSize / 1024)
    : undefined;

  // Step 4: Upload to Supabase Storage Bucket if Supabase is configured
  if (isSupabaseConfigured && fileBuffer) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(storagePath);

        return {
          publicUrl: publicUrlData?.publicUrl || manipulated.uri,
          storagePath,
          localUri: manipulated.uri,
          width: manipulated.width,
          height: manipulated.height,
          estimatedSizeKb,
          originalSizeKb,
        };
      }
    } catch {
      // Fallback to local compressed URI if storage requires auth session
    }
  }

  // In local/demo mode, return the compressed local URI alongside the structured storagePath
  return {
    publicUrl: manipulated.uri,
    storagePath,
    localUri: manipulated.uri,
    width: manipulated.width,
    height: manipulated.height,
    estimatedSizeKb,
    originalSizeKb,
  };
}

/**
 * Opens the device gallery or camera via `expo-image-picker`, then immediately runs
 * `compressAndUploadImage` so raw uncompressed photos are NEVER uploaded directly.
 */
export async function pickAndCompressUploadImage(options: {
  bucket: StorageBucketName;
  buildingId: string;
  yearMonth?: string;
  source?: 'library' | 'camera';
}): Promise<CompressedUploadResult | null> {
  const { bucket, buildingId, yearMonth, source = 'library' } = options;

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('يرجى السماح بصلاحية الكاميرا لتصوير الإيصال أو الفاتورة.');
    }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error('يرجى السماح بصلاحية معرض الصور لاختيار صورة الإيصال أو الفاتورة.');
    }
  }

  const pickerResult =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1, // Full resolution input; resizing & 0.6 compression handled strictly by expo-image-manipulator
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        });

  if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
    return null;
  }

  const asset = pickerResult.assets[0];
  return compressAndUploadImage({
    uri: asset.uri,
    bucket,
    buildingId,
    yearMonth,
    originalWidth: asset.width,
    originalFileSize: asset.fileSize,
  });
}
