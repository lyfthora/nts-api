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
export const publicSubscriptionRoutes = Router();

// GET /api/subscription/portal-return
publicSubscriptionRoutes.get("/portal-return", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to NTS...</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background: #121212;
          color: #fff;
        }
        .container { text-align: center; }
        h1 { font-size: 20px; font-weight: 500; margin-bottom: 10px; }
        p { color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Opening NTS in desktop...</h1>
        <p>If your browser didn't open the app automatically, you can safely close this window.</p>
      </div>
      <script>
        window.location.href = "nts://payment-success";
        setTimeout(function() {
          window.close();
        }, 3000);
      </script>
    </body>
    </html>
  `);
});

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
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host");
    const returnUrl = `${protocol}://${host}/api/subscription/portal-return`;

    const result = await subscriptionService.createPortalSession(req.userId, returnUrl);
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
