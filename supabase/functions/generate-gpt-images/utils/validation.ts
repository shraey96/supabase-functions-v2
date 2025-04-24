import { sendAPIResponse } from "./cors.ts";

// Maximum file size (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validates the request and extracts data
 * @param formData - FormData from the request
 * @returns Object with validation result, response (if validation failed), and extracted data
 */
export function validateRequest(formData: FormData): {
  isValid: boolean;
  response?: Response;
  prompt?: string;
  paymentToken?: string;
  userEmail?: string;
  images?: File[];
} {
  // Extract data
  const prompt = formData.get("prompt");
  const paymentToken = formData.get("paymentToken");
  const userEmail = formData.get("userEmail");

  // Get all images from the 'images' field
  const images: File[] = [];
  const formDataImages = formData.getAll("images");

  for (const item of formDataImages) {
    if (item instanceof File) {
      images.push(item);
    }
  }

  // Validate prompt
  if (!prompt || typeof prompt !== "string") {
    return {
      isValid: false,
      response: sendAPIResponse({ error: "Valid prompt is required" }, 400),
    };
  }

  // Validate user email
  if (!userEmail || typeof userEmail !== "string") {
    return {
      isValid: false,
      response: sendAPIResponse({ error: "Valid user email is required" }, 400),
    };
  }

  // Validate payment token
  if (!paymentToken || typeof paymentToken !== "string") {
    return {
      isValid: false,
      response: sendAPIResponse(
        { error: "Valid payment token is required" },
        400
      ),
    };
  }

  // Validate at least one image is provided
  if (images.length === 0) {
    return {
      isValid: false,
      response: sendAPIResponse(
        { error: "At least one image is required" },
        400
      ),
    };
  }

  // Check file sizes (5MB limit)
  for (const img of images) {
    if (img.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        response: sendAPIResponse(
          { error: `Image ${img.name} exceeds size limit of 5MB` },
          400
        ),
      };
    }
  }

  return {
    isValid: true,
    prompt,
    paymentToken,
    userEmail,
    images,
  };
}

/**
 * Extracts image files from form data
 * @param formData - FormData from the request
 * @returns Array of image files
 */
export function extractImageFiles(formData: FormData): File[] {
  const images: File[] = [];

  // Get all files from the 'images' field
  const formDataImages = formData.getAll("images");

  for (const item of formDataImages) {
    if (item instanceof File) {
      images.push(item);
    }
  }

  return images;
}
