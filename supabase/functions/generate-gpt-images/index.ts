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
import { generateImages } from "./utils/openai.ts";
import { validateRequest } from "./utils/validation.ts";

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

    const { prompt, paymentToken, userEmail, images } = validationResult;

    // Save original images to storage
    const imagePaths: string[] = [];
    for (const img of images!) {
      const imagePath = await processAndSaveImage(img);
      imagePaths.push(imagePath);
    }

    // Store request details in database
    await supabaseClient.from("ad_generation_inputs").insert({
      user_email: userEmail,
      prompt,
      payment_token: paymentToken,
      image_paths: imagePaths,
    });

    // Call OpenAI API directly with the files
    // Use b64_json response format to get base64 data
    const imageResults = await generateImages(
      prompt!,
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
    await storeResultData(userEmail!, resultImageUrls);

    console.log("Result image URLs:", resultImageUrls);

    // Return response with the URLs of the stored images
    return sendAPIResponse({
      success: true,
      images: resultImageUrls,
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
