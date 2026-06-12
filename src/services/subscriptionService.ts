import Stripe from "stripe";
import { prisma } from "../config/database";
import { config } from "../config/env";
import { SubscriptionStatus } from "../types";

type StripeEvent = any;
type StripeSubscription = any;
const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: "2026-05-27.dahlia" as any,
});

export const subscriptionService = {
async getSubscriptionStatus(userId: number): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscription: true, trialEndsAt: true},
  });
    if (!user) throw new Error("User not found");

     const now = new Date();

     // 1. check subscription active in ddbb
     if (user.subscription) {
      const isExpired = user.subscription.status === "canceled" &&
                        user.subscription.currentPeriodEnd &&
                        user.subscription.currentPeriodEnd < now;
      if (!isExpired) {
        return {
          status: user.subscription.status as any,
          trialEndsAt: user.trialEndsAt?.toISOString() || null,
          currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
        };
      }
    }

    // 2. no subscription active, verify trial
    if (user.trialEndsAt && user.trialEndsAt > now) {
      return {
        status: "trialing",
        trialEndsAt: user.trialEndsAt.toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      status: "expired",
      trialEndsAt: user.trialEndsAt?.toISOString() || null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
},

// create stripe session checkout for initial payment
async createCheckoutSession(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  let customerId = user.stripeCustomerId;

  if(!customerId){
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id.toString()},
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id},
      data: { stripeCustomerId: customerId},
    });
  }

  const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: config.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${config.frontendUrl}payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}payment-cancel`,
      subscription_data: {
        metadata: { userId: user.id.toString() },
      },
    });
    return { url: session.url };
  },

  async createPortalSession(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.stripeCustomerId) {
      throw new Error("No active subscription found to manage");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: config.frontendUrl,
    });
    return { url: session.url };
  },

  // event webhooks stripe
  async handleWebhookEvent(payload: string | Buffer, signature: string) {
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripeWebhookSecret
      );
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    const subscription = event.data.object as any;
    const customerId = subscription.customer as string;
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.syncSubscription(subscription);
        break;
      case "customer.subscription.deleted":
        await prisma.subscription.deleteMany({
          where: { stripeSubscriptionId: subscription.id },
        });
        break;
      case "invoice.payment_failed":
        // añadir luego ocmo una notif para el user de que su pago falloi o algo asi xd
        break;
    }
  },

  async syncSubscription(stripeSub: any) {
    const customerId = stripeSub.customer as string;
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!user) return;
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });
  },
};



