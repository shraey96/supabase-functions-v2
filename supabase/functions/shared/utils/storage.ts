// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import supabaseClient from "./supabaseClient.ts";

/**
 * Sanitizes a filename for storage
 * @param fileName - Original filename
 * @returns Sanitized filename
 */
function sanitizeFileName(fileName: string): string {
  // Replace spaces with hyphens and remove any special characters that might cause issues
  return fileName
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9\-_.]/g, "") // Remove special characters except hyphens, underscores, and periods
    .toLowerCase(); // Convert to lowercase
}

/**
 * Saves an image to Supabase Storage
 * @param imageBuffer - The image data as a Uint8Array
 * @param fileName - Original filename
 * @param isResult - Indicates if the image is a result or input
 * @param customPath - Optional custom storage path
 * @returns The public URL of the uploaded image
 */
export async function saveImageToStorage(
  imageBuffer: Uint8Array,
  fileName: string,
  isResult: boolean = false,
  customPath?: string
): Promise<string> {
  // Sanitize the filename
  const sanitizedFileName = sanitizeFileName(fileName);
  let filePath: string;

  if (customPath) {
    filePath = customPath;
    console.log(`Uploading to custom storage path: ${filePath}`);
  } else {
    // Fallback to existing logic if customPath is not provided
    filePath = `ad-generation/${
      isResult ? "results" : "inputs"
    }/${crypto.randomUUID()}-${sanitizedFileName}`;
    console.log(`Uploading to storage path: ${filePath}`);
  }

  try {
    const { error } = await supabaseClient.storage
      .from("ai-generated-ads")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error(`Storage upload error: ${error.message}`);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data } = supabaseClient.storage
      .from("ai-generated-ads")
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error(
      `Error in saveImageToStorage: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

/**
 * Processes and saves a file to Supabase Storage
 * @param file - File object from form data
 * @param customPath - Optional custom storage path
 * @returns The public URL of the uploaded image
 */
export async function processAndSaveImage(
  file: File,
  customPath?: string
): Promise<string> {
  try {
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Pass customPath, isResult is effectively false for original images in this context for fallback
    return await saveImageToStorage(uint8Array, file.name, false, customPath);
  } catch (error) {
    console.error(
      `Error processing image: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

/**
 * Saves base64 encoded image data to Supabase Storage
 * @param base64Data - Base64 encoded image data (without data URL prefix)
 * @param fileName - Name for the saved file
 * @param isResult - Indicates if the image is a result or input
 * @param customPath - Optional custom storage path
 * @returns The public URL of the uploaded image
 */
export async function saveBase64ImageToStorage(
  base64Data: string,
  fileName: string,
  isResult: boolean = false,
  customPath?: string
): Promise<string> {
  try {
    console.log(`Converting base64 data for: ${fileName}`);

    // Convert base64 to Uint8Array properly
    const uint8Array = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );

    // Save to storage
    return await saveImageToStorage(uint8Array, fileName, isResult, customPath);
  } catch (error) {
    console.error(
      `Error saving base64 image: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

/**
 * Converts a File to base64 for API consumption
 * @param file - File object from form data
 * @returns Base64 string of the file
 */
export async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  return btoa(String.fromCharCode(...uint8Array));
}

/**
 * Stores generation results in the database
 * @param userEmail - Email of the user
 * @param resultImageUrls - Array of URLs to generated images
 */
export async function storeResultData(
  userEmail: string,
  resultImageUrls: string[]
) {
  const { error } = await supabaseClient.from("ad_generation_results").insert({
    user_email: userEmail,
    result_image_urls: resultImageUrls,
  });

  if (error) {
    throw new Error(`Failed to store result data: ${error.message}`);
  }
}

/**
 * Generates a standardized storage path for user-specific ad generation files.
 * @param userId - The ID of the user.
 * @param adId - The ID of the ad.
 * @param index - The index of the image (for multiple images).
 * @param isResult - Boolean indicating if the path is for a result image or an input image.
 * @returns The formatted storage path string.
 */
export const getStoragePathForUser = (
  userId: string,
  adId: string,
  index: number,
  isResult: boolean
): string => {
  return isResult
    ? `user-ad-generation/${userId}/result/result_${adId}_${index}.png`
    : `user-ad-generation/${userId}/inputs/input_${adId}_${index}.png`;
};
