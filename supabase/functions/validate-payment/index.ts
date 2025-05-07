// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendAPIResponse, handleOptions } from "../shared/utils/cors.ts";
import supabaseClient from "../shared/utils/supabaseClient.ts";
import {
  validateDodoPayment,
  validateDodoWebhook,
} from "../shared/utils/dodo-payments.ts";
import { CREDIT_UPDATE_MAP } from "../shared/constants.ts";

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return handleOptions();
    }

    if (req.method !== "POST") {
      return sendAPIResponse(
        {
          error: "Method not allowed. Please use POST.",
          error_key: "METHOD_NOT_ALLOWED",
        },
        405
      );
    }

    const isFromWebhook = !!req.headers.get("webhook-id");

    const errorStatusCode = isFromWebhook ? 200 : 422;

    let userId: string | null = null;

    // validate webhook id

    // Parse JSON body
    let requestData: {
      payment_id?: string;
      payment_status?: string;
      data?: {
        payment_id?: string;
        sttus?: string;
        metadata?: { [key: string]: string };
      };
      type?: string;
    } = {};
    try {
      requestData = await req.json();
    } catch (e) {
      return sendAPIResponse({ error: "Invalid JSON body." }, 400);
    }

    console.log({ isFromWebhook, requestData });

    if (isFromWebhook) {
      const dodoWebhookResult = await validateDodoWebhook(req, requestData);
      if (!dodoWebhookResult.isValid) {
        return sendAPIResponse(
          { error: "Dodo webhook validation failed." },
          422
        );
      }
    }

    if (isFromWebhook) {
      userId = requestData.data?.metadata?.user_id || null;
    } else {
      // Get user from JWT token
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return sendAPIResponse(
          {
            error: "No authorization header provided",
            error_key: "AUTH_HEADER_MISSING",
          },
          401
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const jwtPayload = JSON.parse(atob(token.split(".")[1]));
      userId = jwtPayload.sub;

      if (!userId) {
        return sendAPIResponse(
          {
            error: "Invalid token or user ID missing",
            error_key: "INVALID_TOKEN",
          },
          401
        );
      }
    }

    const payment_id = requestData.payment_id || requestData.data?.payment_id;
    const payment_status =
      requestData.payment_status || requestData.data?.status;

    console.log({ payment_id, payment_status });

    if (!payment_id || !payment_status) {
      return sendAPIResponse(
        { error: "payment_id and payment_status are required." },
        errorStatusCode
      );
    }

    if (isFromWebhook && requestData.type !== "payment.succeeded") {
      return sendAPIResponse(
        { error: "Currently only payment.succeeded webhooks are supported." },
        200
      );
    }

    // 1. Check if payment_id has already been processed
    const { data: existingPayment, error: existingPaymentError } =
      await supabaseClient
        .from("payment_transactions")
        .select("id")
        .eq("payment_id", payment_id)
        .maybeSingle();

    if (existingPaymentError) {
      console.error("Error checking existing payment:", existingPaymentError);
      return sendAPIResponse(
        { error: "Failed to verify payment uniqueness." },
        errorStatusCode
      );
    }

    if (existingPayment) {
      console.log("This payment has already been processed.");
      return sendAPIResponse(
        { error: "This payment has already been processed." },
        errorStatusCode // Conflict
      );
    }

    // 2. Validate Payment via Dodo payment util
    const dodoValidationResult = isFromWebhook
      ? {
          isValid: true,
          error: null,
          paymentData: {
            status: payment_status,
          },
          planId: requestData.data?.product_cart?.[0]?.product_id,
        }
      : await validateDodoPayment(payment_id);

    console.log({ dodoValidationResult });

    if (!dodoValidationResult.isValid) {
      return sendAPIResponse(
        {
          error:
            dodoValidationResult.error || "Dodo payment validation failed.",
        },
        errorStatusCode // Payment Required or a specific error code for payment failure
      );
    }

    const { data: userCredits, error: creditsError } = await supabaseClient
      .from("credits")
      .select("amount")
      .eq("user_id", userId)
      .single();

    if (creditsError || !userCredits) {
      console.error(
        "Error fetching user credits record or record not found:",
        creditsError
      );
      return sendAPIResponse(
        { error: "User credits record not found or error fetching credits." },
        errorStatusCode
      );
    }

    const CREDITS_TO_ADD = CREDIT_UPDATE_MAP[dodoValidationResult.planId];

    console.log({ CREDITS_TO_ADD });

    const currentCredits = userCredits.amount;
    const newCredits = currentCredits + CREDITS_TO_ADD;

    console.log({ currentCredits, newCredits });

    // Update user credits
    const { error: updateError } = await supabaseClient
      .from("credits")
      .update({ amount: newCredits })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating user credits:", updateError);
      // Potentially implement a rollback or compensating transaction for Dodo if this fails
      return sendAPIResponse({ error: "Failed to update user credits." }, 500);
    }

    // Record the payment transaction
    const { error: transactionError } = await supabaseClient
      .from("payment_transactions")
      .insert({
        payment_id: payment_id,
        user_id: userId,
        status: dodoValidationResult.paymentData?.status || payment_status, // Prefer validated status
        plan_id: dodoValidationResult.planId, // From Dodo validation
        credits_added: CREDITS_TO_ADD,
      });

    if (transactionError) {
      console.error("Error recording payment transaction:", transactionError);
      // CRITICAL: Rollback credits update if this fails!
      await supabaseClient
        .from("credits")
        .update({ amount: currentCredits }) // Rollback
        .eq("user_id", userId); // Ensure rollback targets the correct user

      return sendAPIResponse(
        {
          error: "Failed to record payment transaction after updating credits.",
        },
        errorStatusCode
      );
    }

    console.log(
      `Successfully processed payment ${payment_id} for user ${userId}. Added ${CREDITS_TO_ADD} credits.`
    );

    return sendAPIResponse({
      success: true,
      message: "Payment validated and credits added successfully.",
      credits_added: CREDITS_TO_ADD,
      new_total_credits: newCredits,
    });
  } catch (error) {
    console.error("Error in validate-payment function:", error);
    return sendAPIResponse(
      {
        error: "Failed to process payment validation.",
        details: error instanceof Error ? error.message : String(error),
      },
      422
    );
  }
});

/*
Example invocation:
// ... (ensure example shows Authorization header)
*/
