import { isDev } from "../../shared/constants.ts";
import { RateLimiterConfig } from "../../shared/utils/rate-limiter.ts";

const MAX_REQUESTS_PER_DAY = isDev ? 10 : 2;

/**
 * Configuration for the generate-gpt-images function
 */
export const config = {
  /** Whether the function is in free mode (with rate limiting) */
  IS_FREE: true,
  /** Rate limiter configuration */
  rateLimiter: {
    maxRequestsPerDay: MAX_REQUESTS_PER_DAY,
    functionName: "generate-gpt-images",
    errorMessage: `You have exceeded the daily limit of ${MAX_REQUESTS_PER_DAY} image generation requests. Please try again tomorrow.`,
  } as RateLimiterConfig,
};
