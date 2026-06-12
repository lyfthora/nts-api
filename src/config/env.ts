import dotenv from "dotenv";
dotenv.config();
export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL || "",
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || "",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePriceId: process.env.STRIPE_PRICE_ID || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  frontendUrl: process.env.FRONTEND_URL || "nts://",
};
