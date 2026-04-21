import { prisma } from "../config/database";

interface CreateNoteInput {
  name?: string;
  content?: string;
  preview?: string;
  color?: string;
  pinned?: boolean;
  deleted?: boolean;
  status?: string;
  tags?: string[];
  noteType?: string;
  drawingData?: string;
  images?: string[];
  folderId?: number;
}

interface UpdateNoteInput {
  name?: string;
  content?: string;
  preview?: string;
  color?: string;
  pinned?: boolean;
  deleted?: boolean;
  status?: string;
  tags?: string[];
  noteType?: string;
  drawingData?: string;
  images?: string[];
  folderId?: number;
}

export const noteService = {
  async getAll(userId: number) {
    return prisma.note.findMany({
      where: { deleted: false, userId },
      orderBy: { updatedAt: "desc" },
      omit: { content: true, drawingData: true },
    });
  },

  async getAllData(userId: number) {
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      omit: { content: true, drawingData: true },
    });
    const folders = await prisma.folder.findMany({
      where: { userId },
    });
    return { notes, folders };
  },

  async getNoteContent(id: number, userId: number) {
    const note = await prisma.note.findFirst({
      where: { id, userId },
      select: { content: true, drawingData: true },
    });
    return note || { content: "", drawingData: null };
  },

  async createNote(input: CreateNoteInput, userId: number) {
    return prisma.note.create({
      data: {
        name: input.name || "",
        content: input.content || "",
        preview: input.preview || "",
        color: input.color || "#ffffff",
        pinned: input.pinned || false,
        deleted: input.deleted || false,
        status: input.status || "",
        tags: input.tags || [],
        noteType: input.noteType || "text",
        drawingData: input.drawingData || null,
        images: input.images || [],
        folderId: input.folderId || null,
        userId,
      },
    });
  },

  async updateNote(id: number, input: UpdateNoteInput, userId: number) {
    const data: Record<string, unknown> = {};
    const validFields = [
      "name", "content", "preview", "color", "pinned",
      "deleted", "status", "tags", "noteType", "drawingData",
      "images", "folderId",
    ];
    for (const field of validFields) {
      if ((input as Record<string, unknown>)[field] !== undefined) {
        data[field] = (input as Record<string, unknown>)[field];
      }
    }
    if (typeof data.content === "string") {
      data.preview = (data.content as string)
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/[#*_`~\[\]]/g, "")
        .trim()
        .substring(0, 150);
    }
    return prisma.note.update({
      where: { id, userId },
      data,
    });
  },

  async deleteNote(id: number, userId: number) {
    return prisma.note.update({
      where: { id, userId },
      data: { deleted: true },
    });
  },

  async restoreNote(id: number, userId: number) {
    return prisma.note.update({
      where: { id, userId },
      data: { deleted: false },
    });
  },

  async deleteNotePermanently(id: number, userId: number) {
    return prisma.note.delete({
      where: { id, userId },
    });
  },

  async getBacklinks(noteName: string, userId: number) {
    const allNotes = await prisma.note.findMany({
      where: { deleted: false, userId },
      select: { id: true, name: true, content: true },
    });
    const pattern = `[[${noteName}]]`;
    return allNotes
      .filter((n) => n.content.includes(pattern))
      .map((n) => ({
        id: n.id,
        name: n.name,
        preview: n.content.substring(0, 100),
      }));
  },
};
