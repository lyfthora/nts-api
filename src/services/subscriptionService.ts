import Stripe from "stripe";
import { prisma } from "../config/database";
import { config } from "../config/env";
import { SubscriptionStatus } from "../types";

type StripeCheckoutSession = {
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeSubscriptionRecord = {
  id: string;
  customer?: string | { id: string } | null;
  status: string;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
};

let stripeClient: ReturnType<typeof createStripeClient> | null = null;

function createStripeClient() {
  return new Stripe(config.stripeSecretKey, {
    apiVersion: "2026-05-27.dahlia" as any,
  });
}

function getStripeClient() {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured");
  }

  if (!stripeClient) {
    stripeClient = createStripeClient();
  }

  return stripeClient;
}

export const subscriptionService = {
  async getSubscriptionStatus(userId: number): Promise<SubscriptionStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: true, trialEndsAt: true },
    });
    if (!user) throw new Error("User not found");

    const now = new Date();

    // 1. check subscription active in ddbb
    if (user.subscription) {
      const isExpired =
        user.subscription.status === "canceled" &&
        user.subscription.currentPeriodEnd &&
        user.subscription.currentPeriodEnd < now;
      if (!isExpired) {
        return {
          status: user.subscription.status as any,
          trialEndsAt: user.trialEndsAt?.toISOString() || null,
          currentPeriodEnd:
            user.subscription.currentPeriodEnd?.toISOString() || null,
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
    if (!config.stripePriceId) {
      throw new Error("Stripe checkout is not configured");
    }

    const stripe = getStripeClient();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id.toString() },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
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
    const stripe = getStripeClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.stripeCustomerId || !user.subscription) {
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
    if (!config.stripeWebhookSecret) {
      throw new Error("Stripe webhook is not configured");
    }

    const stripe = getStripeClient();
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripeWebhookSecret,
      );
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSession;
        await this.syncCheckoutSession(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as StripeSubscriptionRecord;
        await this.syncSubscription(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscriptionRecord;
        await prisma.subscription.deleteMany({
          where: { stripeSubscriptionId: subscription.id },
        });
        break;
      }
      case "invoice.payment_failed":
        // añadir luego ocmo una notif para el user de que su pago falloi o algo asi xd
        break;
    }
  },

  async syncCheckoutSession(session: StripeCheckoutSession) {
    const userId = Number(session.metadata?.userId);
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (!userId || !customerId) {
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });

    if (typeof session.subscription === "string") {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription,
      );
      await this.syncSubscription(subscription);
    }
  },

  async syncSubscription(stripeSub: StripeSubscriptionRecord) {
    const customerId =
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer?.id || null;

    if (!customerId) {
      return;
    }

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      return;
    }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status,
        currentPeriodStart: stripeSub.items.data[0]?.current_period_start
          ? new Date(stripeSub.items.data[0].current_period_start * 1000)
          : null,
        currentPeriodEnd: stripeSub.items.data[0]?.current_period_end
          ? new Date(stripeSub.items.data[0].current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status,
        currentPeriodStart: stripeSub.items.data[0]?.current_period_start
          ? new Date(stripeSub.items.data[0].current_period_start * 1000)
          : null,
        currentPeriodEnd: stripeSub.items.data[0]?.current_period_end
          ? new Date(stripeSub.items.data[0].current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });
  },
};
