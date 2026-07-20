import { Router } from "express";
import type { Request, Response } from "express";
import { assetService } from "../services/assetService";

export const assetRoutes = Router();
//POST /api/assets/upload
assetRoutes.post("/upload", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileBuffer, fileName, noteId} = req.body;
    if (!fileBuffer || !fileName || !noteId){
      res.status(400).json({ error: "Missing fileBuffer, fileName or noteId"});
      return;
    }
    const buffer = Buffer.from(fileBuffer, "base64");
    const url = await assetService.upload(buffer, fileName, noteId);
    res.json({ url});
  } catch (err) {
    console.error("Error uploading asset:", err);
    res.status(500).json({ error: "Error uploading asset"});
  }
});
//post /api/assets/clean
assetRoutes.post("/clean", async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentImages, referencedImages}= req.body;
    await assetService.cleanUnused(currentImages || [], referencedImages || []);
    res.json({ success: true});
    } catch (err) {
    console.error("Error cleaning assets:", err);
    res.status(500).json({ error: "Error cleaning assets" });
  }
});
