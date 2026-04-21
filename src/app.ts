import express from "express";
import cors from "cors";
import { noteRoutes } from "./routes/notes";
import { folderRoutes } from "./routes/folders";
import { assetRoutes } from "./routes/assets";
import { authRoutes } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";

const app = express();

// middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// auth routes
app.use("/api/auth", authRoutes);

// protected routes
app.use("/api/notes", authMiddleware, noteRoutes);
app.use("/api/folders", authMiddleware, folderRoutes);
app.use("/api/assets", authMiddleware, assetRoutes);

// check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
