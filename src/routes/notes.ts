import { Router } from "express";
import type { Request, Response } from "express";
import { noteService } from "../services/noteService";
export const noteRoutes = Router();

// GET /api/notes — Get all notes metadata
noteRoutes.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const notes = await noteService.getAllMetadata();
    res.json(notes);
  } catch (err) {
    console.error("Error fetching notes:", err);
    res.status(500).json({ error: "Error fetching notes" });
  }
});

// GET /api/notes/all — Get all notes and folders
noteRoutes.get("/all", async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await noteService.getAllData();
    res.json(data);
  } catch (err) {
    console.error("Error fetching all data:", err);
    res.status(500).json({ error: "Error fetching data" });
  }
});
// GET /api/notes/:id/content — Get note content
noteRoutes.get("/:id/content", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data = await noteService.getNoteContent(id);
    res.json(data);
  } catch (err) {
    console.error("Error fetching note content:", err);
    res.status(500).json({ error: "Error fetching note content" });
  }
});
// POST /api/notes — Create a new note
noteRoutes.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const note = await noteService.createNote(req.body);
    res.status(201).json(note);
  } catch (err) {
    console.error("Error creating note:", err);
    res.status(500).json({ error: "Error creating note" });
  }
});
// PUT /api/notes/:id — Update a note
noteRoutes.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const note = await noteService.updateNote(id, req.body);
    res.json(note);
  } catch (err) {
    console.error("Error updating note:", err);
    res.status(500).json({ error: "Error updating note" });
  }
});
// DELETE /api/notes/:id — Soft delete (trash)
noteRoutes.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await noteService.softDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting note:", err);
    res.status(500).json({ error: "Error deleting note" });
  }
});
// POST /api/notes/:id/restore — Restore from trash
noteRoutes.post("/:id/restore", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await noteService.restore(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error restoring note:", err);
    res.status(500).json({ error: "Error restoring note" });
  }
});
// DELETE /api/notes/:id/permanent — Delete permanently
noteRoutes.delete("/:id/permanent", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await noteService.deletePermanently(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error permanently deleting note:", err);
    res.status(500).json({ error: "Error permanently deleting note" });
  }
});
// GET /api/notes/:name/backlinks — Get backlinks
noteRoutes.get("/:name/backlinks", async (req: Request, res: Response): Promise<void> => {
  try {
    const backlinks = await noteService.getBacklinks(String(req.params.name));
    res.json(backlinks);
  } catch (err) {
    console.error("Error fetching backlinks:", err);
    res.status(500).json({ error: "Error fetching backlinks" });
  }
});
