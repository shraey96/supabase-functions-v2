import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendAPIResponse } from "./cors.ts";
import supabaseClient from "./supabaseClient.ts";

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
  transactionId?: string;
  userEmail?: string;
  images?: File[];
} {
  // Extract data
  const prompt = formData.get("prompt");
  const transactionId = formData.get("transactionId");
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
  if (!transactionId || typeof transactionId !== "string") {
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
    transactionId,
    userEmail,
    images,
  };
}

/**
 * Validates the ad generation request and extracts data
 * @param formData - FormData from the request
 * @returns Object with validation result, response (if validation failed), and extracted data
 */
export function validateAdFormData(formData: FormData): {
  isValid: boolean;
  response?: Response;
  prompt?: string;
  visualStyle?: string;
  brandId?: string;
  images?: File[];
  numSamples?: number;
  quality?: "high" | "medium" | "low" | "auto";
} {
  // Extract data
  const prompt = formData.get("prompt");
  const visualStyle = formData.get("visualStyle");
  const brandId = formData.get("brandId");
  const numSamples = formData.get("numSamples");
  const quality = formData.get("quality");

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

  // Parse and validate numSamples
  let parsedNumSamples = 1;
  if (numSamples) {
    const parsed = parseInt(numSamples.toString());
    if (isNaN(parsed) || parsed < 1 || parsed > 5) {
      return {
        isValid: false,
        response: sendAPIResponse(
          { error: "Number of samples must be between 1 and 5" },
          400
        ),
      };
    }
    parsedNumSamples = parsed;
  }

  // Validate quality
  let validatedQuality: "high" | "medium" | "low" | "auto" = "auto";
  if (quality) {
    const validQualities = ["high", "medium", "low", "auto"] as const;
    if (
      !validQualities.includes(
        quality.toString() as "high" | "medium" | "low" | "auto"
      )
    ) {
      return {
        isValid: false,
        response: sendAPIResponse(
          { error: "Quality must be one of: 'high', 'medium', 'low', 'auto'" },
          400
        ),
      };
    }
    validatedQuality = quality.toString() as "high" | "medium" | "low" | "auto";
  }

  return {
    isValid: true,
    prompt,
    visualStyle: visualStyle?.toString(),
    brandId: brandId?.toString(),
    images,
    numSamples: parsedNumSamples,
    quality: validatedQuality,
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

/**
 * Validates the ad generation request
 * @param request - The request object
 * @returns Object containing validation result and user email
 */
export async function validateAdRequestAuth(request: Request): Promise<{
  isValid: boolean;
  userEmail: string | null;
  error?: string;
}> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return {
        isValid: false,
        userEmail: null,
        error: "No authorization header provided",
      };
    }

    // Verify the JWT token
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return {
        isValid: false,
        userEmail: null,
        error: "Invalid or expired token",
      };
    }

    // Get user's email
    const userEmail = user.email;
    if (!userEmail) {
      return {
        isValid: false,
        userEmail: null,
        error: "User email not found",
      };
    }

    // Check if user has enough credits
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("credits")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return {
        isValid: false,
        userEmail: null,
        error: "Failed to fetch user data",
      };
    }

    if (userData.credits < 1) {
      return {
        isValid: false,
        userEmail: null,
        error: "Insufficient credits",
      };
    }

    return {
      isValid: true,
      userEmail,
    };
  } catch (error) {
    console.error(
      `Error validating request: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {
      isValid: false,
      userEmail: null,
      error: "Internal server error during validation",
    };
  }
}
