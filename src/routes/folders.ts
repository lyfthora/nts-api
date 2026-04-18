import { Router } from "express";
export const folderRoutes = Router();

folderRoutes.get("/", (_req, res) => {
  res.json([]);
});
