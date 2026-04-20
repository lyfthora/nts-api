import { Router } from "express";
import type { Request, Response } from "express";
import { folderService } from "../services/folderService";

export const folderRoutes = Router();
// get /api/folders -- get all folders
folderRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const folders = await folderService.getAll();
    res.json(folders);
  } catch (err) {
    console.error("Error fetching folders:", err);
    res.status(500).json({ error: "Error fetching folders" });
  }
});
// post /api/folders -- create folder
folderRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const folder = await folderService.create(req.body);
    res.status(201).json(folder);
  } catch (err) {
    console.error("Error creating folder:", err);
    res.status(500).json({ error: "Error creating folder" });
  }
});
// put /api/folders/:id -- update folder
folderRoutes.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const folder = await folderService.update(id, req.body);
    res.json(folder);
  } catch (err) {
    console.error("Error updating folder:", err);
    res.status(500).json({ error: "Error updating folder" });
  }
});
// delete /api/folders/:id -- delete folder
folderRoutes.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await folderService.delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting folder:", err);
    res.status(500).json({ error: "Error deleting folder" });
  }
});
