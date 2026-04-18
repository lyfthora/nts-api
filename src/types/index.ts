export interface CreateNoteInput {
  name?: string;
  content?: string;
  color?: string;
  noteType?: "text" | "drawing";
  folderId?: number | null;
}

export interface UpdateNoteInput {
  name?: string;
  content?: string;
  preview?: string;
  color?: string;
  pinned?: boolean;
  deleted?: boolean;
  status?: string;
  tags?: string[];
  noteType?: string;
  drawingData?: string | null;
  images?: string[];
  folderId?: number | null;
}

export interface CreateFolderInput {
  name: string;
  parentId?: number | null;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: number | null;
  expanded?: boolean;
}
