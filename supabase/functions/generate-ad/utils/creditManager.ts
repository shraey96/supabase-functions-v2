// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import supabaseClient from "../../shared/utils/supabaseClient.ts";

// Types
interface CreditOperation {
  operation: string;
  userId: string;
  operationId?: string;
  params?: Record<string, any>;
}

interface CreditResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  error?: string;
}

/**
 * Calculate credit cost for an operation based on config and parameters
 */
export async function calculateCreditCost(
  operation: string,
  params: Record<string, any> = {}
): Promise<number> {
  // Get the operation config
  const { data, error } = await supabaseClient
    .from("credit_configs")
    .select("base_cost, additional_params")
    .eq("operation", operation)
    .single();

  if (error || !data) {
    console.error(`Error fetching credit config for ${operation}:`, error);
    // Return default cost if config not found
    return 2;
  }

  // Start with base cost
  let totalCost = data.base_cost;

  // Apply additional costs based on params
  const additionalParams = data.additional_params || {};

  // For each parameter that affects cost
  for (const [param, cost] of Object.entries(additionalParams)) {
    // If the param exists in the request and is true/enabled
    if (params[param] && (params[param] === true || params[param] > 0)) {
      // If param is a counter (like number of samples), multiply by the value
      if (typeof params[param] === "number" && params[param] > 1) {
        totalCost += Number(cost) * (params[param] - 1);
      } else {
        // Otherwise add the fixed cost
        totalCost += Number(cost);
      }
    }
  }

  return totalCost;
}

/**
 * Deduct credits with transaction record
 */
export async function deductCredits(
  operationData: CreditOperation
): Promise<CreditResult> {
  const { operation, userId, operationId, params } = operationData;

  try {
    // Calculate credit cost
    const creditCost = await calculateCreditCost(operation, params);

    // Check if user has enough credits
    const { data: userData, error: userError } = await supabaseClient
      .from("credits")
      .select("amount")
      .eq("user_id", userId)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        error: userError?.message || "User has no credit record",
      };
    }

    if (userData.amount < creditCost) {
      return {
        success: false,
        error: "Insufficient credits",
      };
    }

    // Create transaction record in pending state
    const { data: txData, error: txError } = await supabaseClient
      .from("credit_transactions")
      .insert({
        user_id: userId,
        amount: -creditCost, // Negative for deduction
        operation: operation,
        operation_id: operationId,
        status: "pending",
        metadata: params ? { params } : {},
      })
      .select()
      .single();

    if (txError || !txData) {
      return {
        success: false,
        error: txError?.message || "Failed to create transaction record",
      };
    }

    // Update user credits
    const { error: updateError } = await supabaseClient
      .from("credits")
      .update({
        amount: userData.amount - creditCost,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }

    // Mark transaction as completed
    const { error: finishTxError } = await supabaseClient
      .from("credit_transactions")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", txData.id);

    if (finishTxError) {
      return {
        success: false,
        error: finishTxError.message,
      };
    }

    return {
      success: true,
      transactionId: txData.id,
      amount: creditCost,
    };
  } catch (error) {
    console.error("Error in deductCredits:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Refund credits if operation fails
 */
export async function refundCredits(
  transactionId: string,
  reason: string = "Operation failed"
): Promise<CreditResult> {
  try {
    // Get the transaction details
    const { data: txData, error: txError } = await supabaseClient
      .from("credit_transactions")
      .select("user_id, amount, status, metadata")
      .eq("id", transactionId)
      .single();

    if (txError || !txData) {
      return {
        success: false,
        error: txError?.message || "Transaction not found",
      };
    }

    // Only refund if transaction was completed
    if (txData.status !== "completed") {
      return {
        success: false,
        error: `Transaction in ${txData.status} state, cannot refund`,
      };
    }

    // Get current user credits
    const { data: userData, error: userError } = await supabaseClient
      .from("credits")
      .select("amount")
      .eq("user_id", txData.user_id)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        error: userError?.message || "User not found",
      };
    }

    // Calculate refund amount (original amount was negative)
    const refundAmount = Math.abs(txData.amount);

    // Update user credits
    const { error: updateError } = await supabaseClient
      .from("credits")
      .update({
        amount: userData.amount + refundAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", txData.user_id);

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }

    // Mark transaction as refunded
    const { error: updateTxError } = await supabaseClient
      .from("credit_transactions")
      .update({
        status: "refunded",
        metadata: {
          ...txData.metadata,
          refund_reason: reason,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateTxError) {
      return {
        success: false,
        error: updateTxError.message,
      };
    }

    // Create a new transaction record for the refund
    const { error: refundTxError } = await supabaseClient
      .from("credit_transactions")
      .insert({
        user_id: txData.user_id,
        amount: refundAmount, // Positive for addition
        operation: "refund",
        operation_id: transactionId, // Reference the original transaction
        status: "completed",
        metadata: {
          original_transaction: transactionId,
          reason: reason,
        },
      });

    if (refundTxError) {
      return {
        success: false,
        error: refundTxError.message,
      };
    }

    return {
      success: true,
      amount: refundAmount,
    };
  } catch (error) {
    console.error("Error in refundCredits:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Add credits to user account
 */
export async function addCredits(
  userId: string,
  amount: number,
  source: string = "manual_addition",
  metadata: Record<string, any> = {}
): Promise<CreditResult> {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  try {
    // Get current user credits
    const { data: userData, error: userError } = await supabaseClient
      .from("credits")
      .select("amount")
      .eq("user_id", userId)
      .single();

    if (userError) {
      // If user doesn't have a credit record, create one
      if (userError.code === "PGRST116") {
        const { error: insertError } = await supabaseClient
          .from("credits")
          .insert({
            user_id: userId,
            amount: amount,
          });

        if (insertError) {
          return {
            success: false,
            error: insertError.message,
          };
        }
      } else {
        return {
          success: false,
          error: userError.message,
        };
      }
    } else {
      // Update existing user credits
      const { error: updateError } = await supabaseClient
        .from("credits")
        .update({
          amount: userData.amount + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        return {
          success: false,
          error: updateError.message,
        };
      }
    }

    // Create transaction record
    const { data: txData, error: txError } = await supabaseClient
      .from("credit_transactions")
      .insert({
        user_id: userId,
        amount: amount,
        operation: source,
        status: "completed",
        metadata: metadata,
      })
      .select()
      .single();

    if (txError) {
      return {
        success: false,
        error: txError.message,
      };
    }

    return {
      success: true,
      transactionId: txData.id,
      amount: amount,
    };
  } catch (error) {
    console.error("Error in addCredits:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number | null> {
  const { data, error } = await supabaseClient
    .from("credits")
    .select("amount")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    console.error("Error fetching user credits:", error);
    return null;
  }

  return data.amount;
}
