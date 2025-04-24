// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI, { toFile } from "npm:openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

/**
 * Generates images using OpenAI's GPT-image-1 API by sending files directly
 * @param prompt - Text prompt describing the desired images
 * @param imageFiles - Array of File objects to use as references
 * @param count - Number of images to generate (default: 3)
 * @param quality - Quality of the generated images (default: high)
 * @returns Array of base64 encoded images
 */
export async function generateImages(
  prompt: string,
  imageFiles: File[],
  count: number = 3,
  quality: "high" | "medium" | "low" | "auto" = "auto"
): Promise<string[]> {
  // Convert Files to OpenAI compatible format using toFile

  console.log("Converting files to OpenAI compatible format");
  const images = await Promise.all(
    imageFiles.map(async (file) => {
      // Convert File to a stream for toFile
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type || "image/png" });
      const stream = blob.stream();

      // Use OpenAI's toFile utility
      return await toFile(stream, file.name, {
        type: file.type || "image/png",
      });
    })
  );
  console.log("Files converted to OpenAI compatible format");

  // Call OpenAI API with files directly
  console.log("Calling OpenAI API");
  const response = await openai.images.edit({
    model: "gpt-image-1",
    prompt,
    n: count,
    quality,
    size: "1024x1024",
    image: images,
  } as any);

  console.log("OpenAI API response received");

  // Extract and return results based on response format
  return response.data.map((item) => item.b64_json || "");
}

// Export the OpenAI client and toFile utility for direct use if needed
export { openai, toFile };
