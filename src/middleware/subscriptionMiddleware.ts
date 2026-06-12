import type { Response, NextFunction } from "express";
import { subscriptionService } from "../services/subscriptionService";
export async function subscriptionMiddleware(req: any, res: Response, next: NextFunction) {
  try {
    const status = await subscriptionService.getSubscriptionStatus(req.userId);

    // permitir accesi esta en trial o subs
    const hasAccess = ["active", "trialing"].includes(status.status);
    if (!hasAccess) {
       res.status(403).json({
        error: "subscription_required",
        message: "Your trial has expired. Please subscribe to continue using NTS."
      });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Failed to verify subscription status" });
  }
}
