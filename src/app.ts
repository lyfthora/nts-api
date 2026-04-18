import express from "express";
import cors from "cors";
import { noteRoutes } from "./routes/notes";
import { folderRoutes } from "./routes/folders";

const app = express();

//middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

//routes
app.use("/api/notes", noteRoutes);
app.use("/api/folders", folderRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
export default app;
