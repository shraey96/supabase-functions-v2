import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import DodoPayments from "npm:dodopayments";
import { Webhook } from "npm:standardwebhooks";

import { isDev } from "../constants.ts";

const DODO_PAYMENTS_WEBHOOK_KEY = Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY");
const DODO_API_KEY = Deno.env.get("DODO_PAYMENTS_API_KEY");
// const DODO_ENV = isDev ? "test_mode" : "live_mode";

const DODO_ENV = "test_mode";

const dodoClient = new DodoPayments({
  apiKey: DODO_API_KEY,
  environment: DODO_ENV,
});

const dodoWebhook = new Webhook(DODO_PAYMENTS_WEBHOOK_KEY);

// Define interface for the Dodo Payment response
interface DodoPaymentCustomer {
  customer_id: string;
  name: string;
  email: string;
}

interface DodoPaymentProductCartItem {
  product_id: string;
  quantity: number;
}

interface DodoPaymentBilling {
  country: string;
  state: string;
  city: string;
  street: string;
  zipcode: string;
}

interface DodoPaymentResponse {
  payment_id: string;
  business_id: string;
  status: string; // "succeeded", "failed", "pending", etc.
  total_amount: number;
  currency: string;
  payment_method: string | null;
  payment_method_type: string | null;
  created_at: string;
  updated_at: string | null;
  disputes: any[];
  refunds: any[];
  customer: DodoPaymentCustomer;
  subscription_id: string | null;
  product_cart: DodoPaymentProductCartItem[];
  payment_link: string;
  tax: number;
  metadata: Record<string, any>;
  error_message: string | null;
  discount_id: string | null;
  settlement_amount: number;
  settlement_tax: number;
  settlement_currency: string;
  billing: DodoPaymentBilling;
}

interface WebhookUnbrandedRequiredHeaders {
  "webhook-id": string;
  "webhook-signature": string;
  "webhook-timestamp": string;
}

// Function to validate Dodo payment by calling the Dodo API
export async function validateDodoPayment(
  paymentId: string
  // paymentStatus is no longer needed as an argument, it's part of the DodoPaymentResponse
): Promise<{
  isValid: boolean;
  error?: string;
  userIdFromPayment?: string; // e.g., customer.email or from metadata
  planId?: string; // e.g., from product_cart
  paymentData?: DodoPaymentResponse; // Full response from Dodo
}> {
  console.log(
    `Attempting to validate Dodo Payment via API: paymentId=${paymentId}`
  );

  try {
    // Retrieve the payment details from Dodo Payments API
    const payment: DodoPaymentResponse = await dodoClient.payments.retrieve(
      paymentId
    );

    if (payment.status === "succeeded") {
      return {
        isValid: true,
        userIdFromPayment: payment.customer.email, // Or derive from payment.metadata if you pass your internal user ID there
        planId: payment.product_cart?.[0]?.product_id, // Assuming the first product is the plan
        paymentData: payment,
      };
    } else {
      return {
        isValid: false,
        error: payment.error_message || `Payment status is ${payment.status}`,
        paymentData: payment,
      };
    }
  } catch (error) {
    console.error("Error validating Dodo payment via API:", error);
    return {
      isValid: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during Dodo payment validation",
    };
  }
}

export async function validateDodoWebhook(
  req: Request,
  requestData: Record<string, any>
) {
  try {
    const body = requestData;
    const webhookHeaders: WebhookUnbrandedRequiredHeaders = {
      "webhook-id": (req.headers.get("webhook-id") || "") as string,
      "webhook-signature": (req.headers.get("webhook-signature") ||
        "") as string,
      "webhook-timestamp": (req.headers.get("webhook-timestamp") ||
        "") as string,
    };

    console.log({ webhookHeaders, DODO_PAYMENTS_WEBHOOK_KEY });

    const raw = JSON.stringify(body);

    await dodoWebhook.verify(raw, webhookHeaders);

    return {
      isValid: true,
      body,
    };
  } catch (error) {
    console.error("Error validating Dodo webhook:", error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
