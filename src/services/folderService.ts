import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { CreateFolderInput, UpdateFolderInput } from "../types";
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
export const folderService = {
  // get all folders
  async getAll() {
    return prisma.folder.findMany({
      orderBy: { createdAt: "asc" },
    });
  },
  // create folder
  async create(input: CreateFolderInput) {
    return prisma.folder.create({
      data: {
        name: input.name || "New Folder",
        parentId: input.parentId ?? null,
        isSystem: false,
        expanded: true,
      },
    });
  },
  // update folder
  async update(id: number, input: UpdateFolderInput) {
    return prisma.folder.update({
      where: { id },
      data: input,
    });
  },
  // delete folder with cascade
  async delete(id: number) {
    // check if folder is system folder
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) return;
    if (folder.isSystem) {
      throw new Error("Cannot delete system folder");
    }
    // get subfolders recursively
    const toDelete = [id];
    let i = 0;
    while (i < toDelete.length) {
      const children = await prisma.folder.findMany({
        where: { parentId: toDelete[i] },
        select: { id: true },
      });
      toDelete.push(...children.map((c) => c.id));
      i++;
    }
    // Soft-delete
    await prisma.note.updateMany({
      where: { folderId: { in: toDelete } },
      data: { deleted: true, folderId: null },
    });
    // delete folders
    await prisma.folder.deleteMany({
      where: { id: { in: toDelete } },
    });
  },
};
