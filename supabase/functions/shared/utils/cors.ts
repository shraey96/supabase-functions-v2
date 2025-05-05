// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// CORS headers for all responses
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

/**
 * Handles OPTIONS requests for CORS preflight
 * @returns Response with CORS headers
 */
export function handleOptions(): Response {
  return new Response("ok", { headers: corsHeaders });
}

/**
 * Sends a JSON response with CORS headers
 * @param data - The data to send
 * @param status - HTTP status code
 * @param headers - Additional headers to include in the response
 * @returns Response object
 */
export function sendAPIResponse(
  data: any,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
