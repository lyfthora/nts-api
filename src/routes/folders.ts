import { Router } from "express";
import type { Request, Response } from "express";
import { folderService } from "../services/folderService";

export const folderRoutes = Router();

folderRoutes.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const folders = await folderService.getAll(userId);
    res.json(folders);
  } catch (err) {
    console.error("Error fetching folders:", err);
    res.status(500).json({ error: "Error fetching folders" });
  }
});

folderRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const folder = await folderService.create(req.body, userId);
    res.status(201).json(folder);
  } catch (err) {
    console.error("Error creating folder:", err);
    res.status(500).json({ error: "Error creating folder" });
  }
});

folderRoutes.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    const folder = await folderService.update(id, req.body, userId);
    res.json(folder);
  } catch (err) {
    console.error("Error updating folder:", err);
    res.status(500).json({ error: "Error updating folder" });
  }
});

folderRoutes.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    await folderService.delete(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting folder:", err);
    res.status(500).json({ error: "Error deleting folder" });
  }
});
