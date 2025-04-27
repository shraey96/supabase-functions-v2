// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import supabaseClient from "../../generate-gpt-images/utils/supabaseClient.ts";

/**
 * Rate limiter configuration interface
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed per day */
  maxRequestsPerDay: number;
  /** Name of the function/endpoint being rate limited */
  functionName: string;
  /** Optional custom error message */
  errorMessage?: string;
}

/**
 * Rate limiter result interface
 */
interface RateLimiterResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests for today */
  remainingRequests: number;
  /** Error message if request is not allowed */
  error?: string;
}

/**
 * Rate limiter utility that tracks requests by IP address and enforces daily limits
 * @param ipAddress The IP address to check
 * @param config Rate limiter configuration
 * @returns Rate limiter result with allowed status and remaining requests
 */
export async function checkRateLimit(
  ipAddress: string,
  config: RateLimiterConfig
): Promise<RateLimiterResult> {
  if (!ipAddress) {
    throw new Error("IP address is required for rate limiting");
  }

  const { maxRequestsPerDay, functionName, errorMessage } = config;

  try {
    // Get current date in UTC
    const now = new Date();
    const today = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    // Check if there's an existing record for this IP and function
    const { data: existingRecord, error: fetchError } = await supabaseClient
      .from("rate_limits")
      .select("*")
      .eq("ip_address", ipAddress)
      .eq("function_name", functionName)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" error, which is expected for new IPs
      console.error("Error fetching rate limit record:", fetchError);
      throw fetchError;
    }

    // If no record exists, allow the request
    if (!existingRecord) {
      return {
        allowed: true,
        remainingRequests: maxRequestsPerDay,
      };
    }

    // If last request was before today, reset the count
    if (new Date(existingRecord.last_request) < today) {
      const { error: updateError } = await supabaseClient
        .from("rate_limits")
        .update({
          request_count: 0,
          last_request: now.toISOString(),
        })
        .eq("ip_address", ipAddress)
        .eq("function_name", functionName);

      if (updateError) {
        console.error("Error resetting rate limit record:", updateError);
        throw updateError;
      }

      return {
        allowed: true,
        remainingRequests: maxRequestsPerDay,
      };
    }

    // Check if we've exceeded the daily limit
    if (existingRecord.request_count >= maxRequestsPerDay) {
      return {
        allowed: false,
        remainingRequests: 0,
        error:
          errorMessage ||
          `Rate limit exceeded. Maximum ${maxRequestsPerDay} requests per day allowed.`,
      };
    }

    return {
      allowed: true,
      remainingRequests: maxRequestsPerDay - existingRecord.request_count,
    };
  } catch (error) {
    console.error("Rate limiter error:", error);
    // In case of errors, allow the request to proceed
    return {
      allowed: true,
      remainingRequests: 0,
    };
  }
}

/**
 * Updates the rate limit counter for a successful operation
 * @param ipAddress The IP address to update
 * @param config Rate limiter configuration
 * @returns Updated rate limiter result with remaining requests
 */
export async function updateRateLimit(
  ipAddress: string,
  config: RateLimiterConfig
): Promise<RateLimiterResult> {
  if (!ipAddress) {
    throw new Error("IP address is required for rate limiting");
  }

  const { maxRequestsPerDay, functionName } = config;

  try {
    // Get current date in UTC
    const now = new Date();

    // Check if there's an existing record for this IP and function
    const { data: existingRecord, error: fetchError } = await supabaseClient
      .from("rate_limits")
      .select("*")
      .eq("ip_address", ipAddress)
      .eq("function_name", functionName)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching rate limit record:", fetchError);
      throw fetchError;
    }

    // If no record exists, create a new one
    if (!existingRecord) {
      const { error: insertError } = await supabaseClient
        .from("rate_limits")
        .insert({
          ip_address: ipAddress,
          function_name: functionName,
          request_count: 1,
          last_request: now.toISOString(),
          reset_at: new Date(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1
          ).toISOString(),
        });

      if (insertError) {
        console.error("Error creating rate limit record:", insertError);
        throw insertError;
      }

      return {
        allowed: true,
        remainingRequests: maxRequestsPerDay - 1,
      };
    }

    // Update the request count
    const { error: updateError } = await supabaseClient
      .from("rate_limits")
      .update({
        request_count: existingRecord.request_count + 1,
        last_request: now.toISOString(),
        reset_at: new Date(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        ).toISOString(),
      })
      .eq("ip_address", ipAddress)
      .eq("function_name", functionName);

    if (updateError) {
      console.error("Error updating rate limit record:", updateError);
      throw updateError;
    }

    return {
      allowed: true,
      remainingRequests: maxRequestsPerDay - (existingRecord.request_count + 1),
    };
  } catch (error) {
    console.error("Rate limiter error:", error);
    // In case of errors, allow the request to proceed
    return {
      allowed: true,
      remainingRequests: 0,
    };
  }
}

/**
 * SQL to create the rate_limits table:
 *
 * CREATE TABLE rate_limits (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   ip_address TEXT NOT NULL,
 *   function_name TEXT NOT NULL,
 *   request_count INTEGER NOT NULL DEFAULT 1,
 *   last_request TIMESTAMP WITH TIME ZONE NOT NULL,
 *   reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   UNIQUE(ip_address, function_name)
 * );
 *
 * CREATE INDEX idx_rate_limits_ip_function ON rate_limits(ip_address, function_name);
 */
