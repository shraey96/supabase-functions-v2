// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import utility functions
import { sendAPIResponse, handleOptions } from "../shared/utils/cors.ts";
import supabaseClient from "../shared/utils/supabaseClient.ts";

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return handleOptions();
    }

    // Check method
    if (req.method !== "DELETE") {
      return sendAPIResponse({ error: "Method not allowed" }, 405);
    }

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

    // Get ad ID from request body
    const { adId } = await req.json();
    if (!adId) {
      return sendAPIResponse({ error: "Ad ID is required" }, 400);
    }

    // Get the ad record first to check ownership and get file paths
    const { data: ad, error: fetchError } = await supabaseClient
      .from("generated_ads")
      .select("*")
      .eq("id", adId)
      .single();

    if (fetchError || !ad) {
      return sendAPIResponse({ error: "Ad not found or access denied" }, 404);
    }

    // Check if user owns the ad
    if (ad.user_id !== userId) {
      return sendAPIResponse(
        { error: "You don't have permission to delete this ad" },
        403
      );
    }

    // Delete files from storage
    const deletePromises: Promise<void>[] = [];

    // Delete original images
    if (ad.original_image_urls && ad.original_image_urls.length > 0) {
      for (const url of ad.original_image_urls) {
        if (url) {
          const path = url.split("/public/")[1]?.split("?")[0];
          if (path) {
            deletePromises.push(
              supabaseClient.storage
                .from("ai-generated-ads")
                .remove([path])
                .then(({ error }) => {
                  if (error) {
                    console.error(
                      `Error deleting original image: ${error.message}`
                    );
                  }
                })
            );
          }
        }
      }
    }

    // Delete result images
    if (ad.result_urls && ad.result_urls.length > 0) {
      for (const url of ad.result_urls) {
        if (url) {
          const path = url.split("/public/")[1]?.split("?")[0];
          if (path) {
            deletePromises.push(
              supabaseClient.storage
                .from("ai-generated-ads")
                .remove([path])
                .then(({ error }) => {
                  if (error) {
                    console.error(
                      `Error deleting result image: ${error.message}`
                    );
                  }
                })
            );
          }
        }
      }
    }

    // Wait for all storage deletions to complete
    await Promise.all(deletePromises);

    // Delete the ad record
    const { error: deleteError } = await supabaseClient
      .from("generated_ads")
      .delete()
      .eq("id", adId);

    if (deleteError) {
      return sendAPIResponse(
        { error: `Failed to delete ad: ${deleteError.message}` },
        500
      );
    }

    return sendAPIResponse({ success: true });
  } catch (error) {
    console.error("Error in delete-ad function:", error);
    return sendAPIResponse(
      {
        error: "Failed to delete ad",
        details: error.message,
      },
      500
    );
  }
});
