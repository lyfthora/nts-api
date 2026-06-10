import { prisma } from "../config/database";

export const folderService = {
  async getAll(userId: number) {
    return prisma.folder.findMany({
      where: { userId},
      orderBy: { id: 'asc'},
    });
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
    const getAllDescendantFolderIds = async (parentId: number): Promise<number[]> => {
      const children = await prisma.folder.findMany({
        where: { parentId, userId },
        select: { id: true },
      });
      const ids: number[] = [];
      for (const child of children) {
        ids.push(child.id);
        ids.push(...(await getAllDescendantFolderIds(child.id)));
      }
      return ids;
    };
    const descendantIds = await getAllDescendantFolderIds(id);
    const allFolderIds = [id, ...descendantIds];
    await prisma.note.updateMany({
      where: { folderId: { in: allFolderIds }, userId },
      data: { deleted: true, folderId: null },
    });
    if (descendantIds.length > 0) {
      await prisma.folder.deleteMany({
        where: { id: { in: descendantIds }, userId },
      });
    }
    return prisma.folder.delete({
      where: { id, userId },
    });
  },
};
