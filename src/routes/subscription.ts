import { Router } from "express";
import type { Request, Response } from "express";
import { subscriptionService } from "../services/subscriptionService";


export const subscriptionRoutes = Router();
export const stripeWebhookRoute = Router();


// GET /api/subscription/status
subscriptionRoutes.get("/status", async (req: any, res: Response) => {
  try {
    const status = await subscriptionService.getSubscriptionStatus(req.userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription/checkout
subscriptionRoutes.post("/checkout", async (req: any, res: Response) => {
  try {
    const result = await subscriptionService.createCheckoutSession(req.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription/portal
subscriptionRoutes.post("/portal", async (req: any, res: Response) => {
  try {
    const result = await subscriptionService.createPortalSession(req.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
