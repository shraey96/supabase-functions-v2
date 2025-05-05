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

interface CreditTransaction {
  userId: string;
  amount: number;
  operation: string;
  operationId?: string;
  description?: string;
}

interface CreditResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  error?: string;
}

/**
 * Calculates the total credit cost for an operation
 * @param operation - The operation type
 * @param params - Additional parameters affecting the cost
 * @returns The total credit cost
 */
export async function calculateCreditCost(
  operation: string,
  params: Record<string, any> = {}
): Promise<number> {
  try {
    // Get the operation configuration
    const { data: configs, error } = await supabaseClient
      .from("credit_configs")
      .select("*")
      .eq("operation", operation)
      .limit(1);

    if (error) {
      console.error("Error fetching credit config:", error);
      return 2; // Default cost if config not found
    }

    const config = configs?.[0];
    if (!config) {
      console.error("No credit config found for operation:", operation);
      return 2; // Default cost if config not found
    }

    // if we add a premium user later, just use base cost instead of this.
    let totalCost = config.additional_params[params.quality];

    // Get quantity from params, default to 1 if not specified
    const quantity = params.numSamples || 1;

    const actualQuality = params.quality?.replace("_image", "");

    // Add quality-based costs
    // if (actualQuality === "high") {
    //   totalCost += config.additional_params.high_image;
    // } else if (actualQuality === "medium") {
    //   totalCost += config.additional_params.medium_image;
    // }

    // Add premium style cost if applicable
    // if (params.premium_style) {
    //   totalCost += config.additional_params.premium_style;
    // }

    // // Add cost for extra samples if more than 1
    // if (params.numSamples > 1) {
    //   totalCost +=
    //     config.additional_params.extra_sample * (params.numSamples - 1);
    // }

    // Multiply by quantity
    totalCost *= quantity;

    return totalCost;
  } catch (error) {
    console.error("Error calculating credit cost:", error);
    return 2; // Default cost if calculation fails
  }
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
