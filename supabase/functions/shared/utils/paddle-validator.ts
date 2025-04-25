// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Paddle Transaction Validator utility
 * Validates if a Paddle transaction has a 'completed' status
 */

// Define interfaces for Paddle API response
interface PaddleTransaction {
  data: {
    id: string;
    status: string;
    customer_id: string;
    subscription_id: string | null;
    currency_code: string;
    items: Array<{
      price: {
        id: string;
        name: string;
      };
      quantity: number;
    }>;
    details: {
      totals: {
        total: string;
        currency_code: string;
      };
    };
  };
  meta: {
    request_id: string;
  };
}

const isDev = Deno.env.get("IS_DEV") === "true";

const PADDLE_BASE_URL = isDev
  ? "https://sandbox-api.paddle.com"
  : "https://api.paddle.com";

/**
 * Validates a Paddle transaction by checking its status
 * @param transactionId The Paddle transaction ID to validate
 * @param apiKey Optional API key for Paddle API authentication
 * @returns Transaction data if valid (status is 'completed'), otherwise throws an error
 */
export async function validatePaddleTransaction(
  transactionId: string,
  apiKey: string = Deno.env.get("PADDLE_API_KEY") || ""
): Promise<PaddleTransaction["data"]> {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  if (!apiKey) {
    throw new Error("Paddle API key is required");
  }

  console.log(`Validating Paddle transaction: ${transactionId}`);

  try {
    const response = await fetch(
      `${PADDLE_BASE_URL}/transactions/${transactionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Paddle API error:", errorData);
      throw new Error(
        `Paddle API error: ${response.status} ${response.statusText}`
      );
    }

    const transactionData = (await response.json()) as PaddleTransaction;

    console.log(`Transaction status: ${transactionData.data.status}`);

    // Validate transaction status - only 'completed' is considered valid
    if (transactionData.data.status !== "completed") {
      throw new Error(
        `Invalid transaction status: ${transactionData.data.status}`
      );
    }

    return transactionData.data;
  } catch (error) {
    console.error("Failed to validate Paddle transaction:", error);
    throw error;
  }
}
