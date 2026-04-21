import { Router } from "express";
import type { Request, Response } from "express";
import { noteService } from "../services/noteService";

export const noteRoutes = Router();

noteRoutes.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const notes = await noteService.getAll(userId);
    res.json(notes);
  } catch (err) {
    console.error("Error fetching notes:", err);
    res.status(500).json({ error: "Error fetching notes" });
  }
});

noteRoutes.get("/all", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const data = await noteService.getAllData(userId);
    res.json(data);
  } catch (err) {
    console.error("Error fetching all data:", err);
    res.status(500).json({ error: "Error fetching all data" });
  }
});

noteRoutes.get("/:id/content", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    const data = await noteService.getNoteContent(id, userId);
    res.json(data);
  } catch (err) {
    console.error("Error fetching note content:", err);
    res.status(500).json({ error: "Error fetching note content" });
  }
});

noteRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const note = await noteService.createNote(req.body, userId);
    res.status(201).json(note);
  } catch (err) {
    console.error("Error creating note:", err);
    res.status(500).json({ error: "Error creating note" });
  }
});

noteRoutes.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    const note = await noteService.updateNote(id, req.body, userId);
    res.json(note);
  } catch (err) {
    console.error("Error updating note:", err);
    res.status(500).json({ error: "Error updating note" });
  }
});

noteRoutes.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    await noteService.deleteNote(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting note:", err);
    res.status(500).json({ error: "Error deleting note" });
  }
});

noteRoutes.post("/:id/restore", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    await noteService.restoreNote(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error restoring note:", err);
    res.status(500).json({ error: "Error restoring note" });
  }
});

noteRoutes.delete("/:id/permanent", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = (req as any).userId;
    await noteService.deleteNotePermanently(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting note permanently:", err);
    res.status(500).json({ error: "Error deleting note permanently" });
  }
});

noteRoutes.get("/:noteName/backlinks", async (req: Request, res: Response): Promise<void> => {
  try {
    const noteName = decodeURIComponent(String(req.params.noteName));
    const userId = (req as any).userId;
    const backlinks = await noteService.getBacklinks(noteName, userId);
    res.json(backlinks);
  } catch (err) {
    console.error("Error fetching backlinks:", err);
    res.status(500).json({ error: "Error fetching backlinks" });
  }
});
