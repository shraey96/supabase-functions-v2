export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const sendAPIResponse = (
  data: unknown = {},
  status = 200,
  extraHeaders = {}
) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
};

// Handle OPTIONS requests for CORS
export async function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
