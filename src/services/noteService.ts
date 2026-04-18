import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { CreateNoteInput, UpdateNoteInput } from "../types";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });


export const noteService = {
  async getAllMetadata() {
    return prisma.note.findMany({
      select: {
        id: true,
        name: true,
        preview: true,
        color: true,
        pinned: true,
        deleted: true,
        status: true,
        tags: true,
        noteType: true,
        images: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  },
  async getAllData() {
    const notes = await this.getAllMetadata();
    const folders = await prisma.folder.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { notes, folders };
  },
  async getNoteContent(id: number) {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { content: true, drawingData: true },
    });
    return note || { content: "", drawingData: null };
  },
  async createNote(input: CreateNoteInput) {
    return prisma.note.create({
      data: {
        name: input.name ?? "",
        content: input.content ?? "",
        color: input.color ?? "#ffffff",
        noteType: input.noteType ?? "text",
        folderId: input.folderId ?? null,
      },
    });
  },
  async updateNote(id: number, input: UpdateNoteInput) {
    const data: Record<string, unknown> = { ...input };
    if (input.content !== undefined) {
      data.preview = input.content
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/[#*_`~\[\]]/g, "")
        .trim()
        .substring(0, 150);
    }
    return prisma.note.update({
      where: { id },
      data,
    });
  },
  async softDelete(id: number) {
    return prisma.note.update({
      where: { id },
      data: { deleted: true },
    });
  },
  async restore(id: number) {
    return prisma.note.update({
      where: { id },
      data: { deleted: false },
    });
  },

  async deletePermanently(id: number) {
    return prisma.note.delete({
      where: { id },
    });
  },

  async getBacklinks(noteName: string) {
    const allNotes = await prisma.note.findMany({
      where: { deleted: false },
      select: { id: true, name: true, content: true, preview: true },
    });
    const backlinks: { id: number; name: string; preview: string }[] = [];
    const regex = /@"([^"]+)"|@(\S+)/g;
    for (const note of allNotes) {
      const links: string[] = [];
      let match;
      while ((match = regex.exec(note.content)) !== null) {
        links.push(match[1] || match[2]);
      }
      regex.lastIndex = 0;
      if (links.includes(noteName)) {
        backlinks.push({
          id: note.id,
          name: note.name,
          preview: note.preview,
        });
      }
    }
    return backlinks;
  },
};
