// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isDev } from "../shared/constants.ts";

// Import utility functions
import { sendAPIResponse, handleOptions } from "../shared/utils/cors.ts";
import {
  processAndSaveImage,
  saveBase64ImageToStorage,
  getStoragePathForUser,
} from "../shared/utils/storage.ts";
import supabaseClient from "../shared/utils/supabaseClient.ts";
import { generateImages, getImageGenPrompt } from "../shared/utils/openai.ts";
import {
  deductCredits,
  refundCredits,
  calculateCreditCost,
} from "./utils/creditManager.ts";
import { validateAdFormData } from "../shared/utils/validation.ts";

// Function to save image with the correct path format

Deno.serve(async (req: Request) => {
  // Variable to store transaction ID for potential refund
  let creditTransactionId: string | null = null;

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

    // Get user from JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return sendAPIResponse(
        { error: "No authorization header provided" },
        401
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub;

    if (!userId) {
      return sendAPIResponse({ error: "Invalid token" }, 401);
    }

    // Validate the request
    const validationResult = validateAdFormData(formData);
    if (!validationResult.isValid) {
      return validationResult.response!;
    }

    const {
      prompt,
      name,
      adType,
      brandId,
      images,
      numSamples = 1,
      quality = "medium" as const,
    } = validationResult;

    // Prepare parameters that affect credit cost
    const creditParams = {
      quality: `${quality}_image`,
      numSamples,
    };

    console.log("creditParams", creditParams);

    // Calculate estimated credit cost
    const estimatedCreditCost = await calculateCreditCost(
      "generate_ad",
      creditParams
    );

    console.log("estimatedCreditCost", estimatedCreditCost);

    // Skip credit check in dev mode

    // Deduct credits
    const creditResult = await deductCredits({
      operation: "generate_ad",
      userId: userId!,
      params: creditParams,
    });

    if (!creditResult.success) {
      return sendAPIResponse(
        {
          error: creditResult.error || "Failed to process credits",
          requiredCredits: estimatedCreditCost,
        },
        402
      );
    }

    // Store transaction ID for potential refund
    creditTransactionId = creditResult.transactionId!;

    // Create a new ad record with status 'pending'
    const { data: adData, error: adError } = await supabaseClient
      .from("generated_ads")
      .insert({
        user_id: userId,
        brand_id: brandId || null, // Optional brand ID
        name: name || "Untitled Ad",
        prompt: prompt,
        ad_type: adType || "standard",
        status: "pending",
        credits_used: estimatedCreditCost,
        metadata: {
          ...creditParams,
          num_samples: numSamples,
          quality: quality,
        },
      })
      .select()
      .single();

    if (adError || !adData) {
      // Refund credits if ad creation fails
      if (creditTransactionId) {
        await refundCredits(creditTransactionId, "Failed to create ad record");
      }

      return sendAPIResponse(
        {
          error: `Failed to create ad record: ${adError?.message}`,
        },
        500
      );
    }

    const adId = adData.id;

    try {
      // Save original images to storage
      const imagePaths: string[] = [];
      for (let i = 0; i < images!.length; i++) {
        const inputImagePath = getStoragePathForUser(userId, adId, i, false);
        const imagePath = await processAndSaveImage(images![i], inputImagePath);
        imagePaths.push(imagePath);
      }

      // Update the ad record with original image paths
      await supabaseClient
        .from("generated_ads")
        .update({
          original_image_urls: imagePaths,
        })
        .eq("id", adId);

      // Format the prompt using OpenAI
      const formattedPrompt = await getImageGenPrompt(prompt!);

      // Call OpenAI API directly with the files
      const imageResults = await generateImages(
        formattedPrompt,
        images!,
        numSamples,
        // quality
        isDev ? "low" : "medium"
      );

      // Save the generated images to storage
      const resultImageUrls: string[] = [];
      for (let i = 0; i < imageResults.length; i++) {
        const base64Data = imageResults[i];
        const resultImagePath = getStoragePathForUser(userId, adId, i, true);
        // Extract filename from the path for the 'fileName' argument, though it's less critical now
        const resultFileName = resultImagePath.substring(
          resultImagePath.lastIndexOf("/") + 1
        );
        const resultImageUrl = await saveBase64ImageToStorage(
          base64Data,
          resultFileName,
          true, // isResult is conceptually true
          resultImagePath // Pass the full custom path
        );
        resultImageUrls.push(resultImageUrl);
      }

      // Update the ad record with status 'completed' and result URLs
      await supabaseClient
        .from("generated_ads")
        .update({
          status: "completed",
          result_urls: resultImageUrls,
          completed_at: new Date().toISOString(),
        })
        .eq("id", adId);

      // Return response with the ad_id and URLs of the stored images
      return sendAPIResponse({
        success: true,
        ad_id: adId,
        images: resultImageUrls,
        credits_used: estimatedCreditCost,
      });
    } catch (error) {
      // If any error occurs during processing, mark the ad as failed
      await supabaseClient
        .from("generated_ads")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", adId);

      // Refund credits due to failure
      if (creditTransactionId) {
        await refundCredits(
          creditTransactionId,
          `Processing error: ${error.message}`
        );
      }

      throw error; // Re-throw to be caught by outer try/catch
    }
  } catch (error) {
    console.error("Error in generate-ad function:", error);
    return sendAPIResponse(
      {
        error: "Failed to generate ad",
        details: error.message,
      },
      500
    );
  }
});
