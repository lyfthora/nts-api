import express from "express";
import cors from "cors";
import { noteRoutes } from "./routes/notes";
import { folderRoutes } from "./routes/folders";
import { assetRoutes } from "./routes/assets";
import { authRoutes } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { subscriptionRoutes, stripeWebhookRoute, publicSubscriptionRoutes } from "./routes/subscription";
import { subscriptionMiddleware } from "./middleware/subscriptionMiddleware";
import passport from "passport";
import "./config/passport";

const app = express();

// middleware
app.use(cors());
//webhook stripe
app.use("/api/webhooks", express.raw({ type: "application/json" }), stripeWebhookRoute);
app.use(express.json({ limit: "10mb" }));
app.use(passport.initialize());

// auth routes
app.use("/api/auth", authRoutes);

// subscription public routes
app.use("/api/subscription", publicSubscriptionRoutes);

// subscription routes
app.use("/api/subscription", authMiddleware, subscriptionRoutes);

// protected routes
app.use("/api/notes", authMiddleware, noteRoutes);
app.use("/api/folders", authMiddleware, folderRoutes);
app.use("/api/assets", authMiddleware, assetRoutes);

// check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
