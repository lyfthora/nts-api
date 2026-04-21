import { prisma } from "../config/database";

export const folderService = {
  async getAll(userId: number) {
    return prisma.folder.findMany({ where: { userId } });
  },

  async create(data: { name: string; parentId?: number | null }, userId: number) {
    return prisma.folder.create({
      data: {
        name: data.name,
        parentId: data.parentId || null,
        userId,
      },
    });
  },

  async update(id: number, data: Record<string, unknown>, userId: number) {
    const validFields = ["name", "parentId", "expanded"];
    const filtered: Record<string, unknown> = {};
    for (const field of validFields) {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    }
    return prisma.folder.update({
      where: { id, userId },
      data: filtered,
    });
  },

  async delete(id: number, userId: number) {
    await prisma.note.updateMany({
      where: { folderId: id, userId },
      data: { folderId: null },
    });
    await prisma.folder.deleteMany({
      where: { parentId: id, userId },
    });
    return prisma.folder.delete({
      where: { id, userId },
    });
  },
};
