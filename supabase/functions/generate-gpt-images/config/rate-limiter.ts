import { RateLimiterConfig } from "../../shared/utils/rate-limiter.ts";

/**
 * Configuration for the generate-gpt-images function
 */
export const config = {
  /** Whether the function is in free mode (with rate limiting) */
  IS_FREE: true,
  /** Rate limiter configuration */
  rateLimiter: {
    maxRequestsPerDay: 3,
    functionName: "generate-gpt-images",
    errorMessage:
      "You have exceeded the daily limit of 3 image generation requests. Please try again tomorrow.",
  } as RateLimiterConfig,
};
