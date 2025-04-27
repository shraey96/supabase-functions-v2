// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import utility functions
import { CORS_HEADERS, sendAPIResponse } from "./utils/cors.ts";
import {
  processAndSaveImage,
  saveBase64ImageToStorage,
  storeResultData,
} from "./utils/storage.ts";
import supabaseClient from "./utils/supabaseClient.ts";
import { generateImages, getImageGenPrompt } from "./utils/openai.ts";
import { validateRequest } from "./utils/validation.ts";
import { validatePaddleTransaction } from "../shared/utils/paddle-validator.ts";
import { checkRateLimit } from "../shared/utils/rate-limiter.ts";
import { config } from "./config/rate-limiter.ts";
import { updateRateLimit } from "../shared/utils/rate-limiter.ts";

// Handle OPTIONS requests for CORS
async function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return handleOptions();
    }

    // Check method
    if (req.method !== "POST") {
      return sendAPIResponse({ error: "Method not allowed" }, 405);
    }

    // Parse form data
    const formData = await req.formData();

    // Validate request and extract data
    const validationResult = validateRequest(formData);
    if (!validationResult.isValid) {
      return validationResult.response!;
    }

    const { prompt, transactionId, userEmail, images } = validationResult;

    // Get client IP address from headers
    const ipAddress =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-client-ip") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("true-client-ip") ||
      req.headers.get("x-cluster-client-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-forwarded")?.split(",")[0] ||
      "unknown";
    console.log(`Request from IP: ${ipAddress}`);

    let remainingRequests: number | undefined;

    // Only check rate limit in free mode
    if (config.IS_FREE) {
      // Check rate limit
      const rateLimitResult = await checkRateLimit(
        ipAddress,
        config.rateLimiter
      );

      if (!rateLimitResult.allowed) {
        return sendAPIResponse(
          {
            error: rateLimitResult.error,
            remainingRequests: rateLimitResult.remainingRequests,
          },
          429
        );
      }
    }

    console.log(`Processing request for transaction: ${transactionId}`);

    // check if transaction_id is not present in the database
    const { data, error } = await supabaseClient
      .from("ad_generation_inputs")
      .select("*")
      .eq("transaction_id", transactionId);

    if (error) {
      return sendAPIResponse(
        {
          error: `Failed to check transaction: ${error.message}`,
        },
        400
      );
    }

    if (data && data.length > 0) {
      return sendAPIResponse(
        {
          error: `Transaction already processed for ${transactionId}`,
        },
        400
      );
    }

    // Only validate transaction with Paddle API in paid mode
    if (!config.IS_FREE) {
      try {
        console.log("Validating transaction with Paddle API");
        const transaction = await validatePaddleTransaction(transactionId!);
        console.log(`Transaction validated: ${transaction.id}`);
      } catch (paddleError) {
        console.error("Paddle validation failed:", paddleError);
        return sendAPIResponse(
          {
            error: "Invalid transaction",
            details: paddleError.message,
          },
          400
        );
      }
    }

    // Save original images to storage
    console.log("Processing and saving original images");
    const imagePaths: string[] = [];
    for (const img of images!) {
      const imagePath = await processAndSaveImage(img);
      imagePaths.push(imagePath);
    }

    // Store request details in database
    console.log("Storing request details in database");
    await supabaseClient.from("ad_generation_inputs").insert({
      user_email: userEmail,
      prompt,
      transaction_id: transactionId,
      image_paths: imagePaths,
    });

    console.log("Calling OpenAI API to format prompt");
    const formattedPrompt = await getImageGenPrompt(prompt!);

    console.log("Formatted prompt:", formattedPrompt);

    // Call OpenAI API directly with the files
    console.log("Calling OpenAI API to generate images");
    const imageResults = await generateImages(
      formattedPrompt,
      images!,
      1 // Number of images to generate
    );

    console.log("Uploading results to storage");
    // Save the generated images to storage
    const resultImageUrls: string[] = [];
    for (let i = 0; i < imageResults.length; i++) {
      const base64Data = imageResults[i];
      const resultImageUrl = await saveBase64ImageToStorage(
        base64Data,
        `generated-ad-${i + 1}.png`,
        true
      );
      resultImageUrls.push(resultImageUrl);
    }

    // Store results in database
    console.log("Storing results in database");
    await storeResultData(userEmail!, resultImageUrls);

    // Only update rate limit in free mode after successful image generation
    if (config.IS_FREE) {
      const rateLimitResult = await updateRateLimit(
        ipAddress,
        config.rateLimiter
      );
      remainingRequests = rateLimitResult.remainingRequests;
    }

    console.log("Result image URLs:", resultImageUrls);

    // Return response with the URLs of the stored images
    return sendAPIResponse({
      success: true,
      images: resultImageUrls,
      ...(config.IS_FREE && { remainingRequests }),
    });
  } catch (error) {
    console.error("Error in generate-gpt-images function:", error);

    return sendAPIResponse(
      {
        error: "Failed to generate images",
        details: error.message,
      },
      400
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request with curl or a similar tool, including:
     - Form data with: prompt, userEmail, paymentToken, and multiple image files

  Example (replace with actual file paths and values):
  
  curl -i --location --request POST 'http://127.0.0.1:54325/functions/v1/generate-gpt-images' \
    --form 'prompt="Create a lovely gift basket with these items in it"' \
    --form 'userEmail="user@example.com"' \
    --form 'paymentToken="tok_test123"' \
    --form 'images=@"/path/to/image1.jpg"' \
    --form 'images=@"/path/to/image2.jpg"' \
    --form 'images=@"/path/to/image3.jpg"'
*/
