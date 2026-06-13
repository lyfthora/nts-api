import { Router } from "express";
import type { Request, Response } from "express";
import Stripe from "stripe";
import { subscriptionService } from "../services/subscriptionService";

function getErrorResponse(err: unknown): {
  status: number;
  body: { error: string };
} {
  const message = err instanceof Error ? err.message : "Internal server error";

  if (
    message === "User not found" ||
    message === "No active subscription found to manage"
  ) {
    return { status: 404, body: { error: message } };
  }

  if (
    message === "Stripe is not configured" ||
    message === "Stripe checkout is not configured" ||
    message === "Stripe webhook is not configured"
  ) {
    return { status: 503, body: { error: message } };
  }

  if (err instanceof Stripe.errors.StripeError) {
    return { status: 502, body: { error: err.message } };
  }

  return { status: 500, body: { error: message } };
}

export const subscriptionRoutes = Router();
export const stripeWebhookRoute = Router();

// GET /api/subscription/status
subscriptionRoutes.get("/status", async (req: any, res: Response) => {
  try {
    const status = await subscriptionService.getSubscriptionStatus(req.userId);
    res.json(status);
  } catch (err: unknown) {
    const { status, body } = getErrorResponse(err);
    res.status(status).json(body);
  }
});

// POST /api/subscription/checkout
subscriptionRoutes.post("/checkout", async (req: any, res: Response) => {
  try {
    const result = await subscriptionService.createCheckoutSession(req.userId);
    res.json(result);
  } catch (err: unknown) {
    const { status, body } = getErrorResponse(err);
    res.status(status).json(body);
  }
});

// POST /api/subscription/portal
subscriptionRoutes.post("/portal", async (req: any, res: Response) => {
  try {
    const result = await subscriptionService.createPortalSession(req.userId);
    res.json(result);
  } catch (err: unknown) {
    const { status, body } = getErrorResponse(err);
    res.status(status).json(body);
  }
});

// WEBHOOK
stripeWebhookRoute.post("/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  try {
    // payload en raw (buffer)
    await subscriptionService.handleWebhookEvent(req.body, sig);
    res.json({ received: true });
  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
