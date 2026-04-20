import crypto from "crypto";
import path from "path";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "../config/r2";

export const assetService = {
  async upload(
    fileBuffer: Buffer,
    fileName: string,
    noteId: number
  ): Promise<string>{
    const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
    const ext = path.extname(fileName);
    const key = `img-${noteId}-${hash.substring(0, 8)}${ext}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: getContentType(ext),
      })
    );
   return `${R2_PUBLIC_URL}/${key}`;
  },
  async delete(key: string): Promise<void> {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
  },
  async cleanUnused(
    currentImages: string[],
    referencedImages: string[]
  ): Promise<void> {
    const unused = currentImages.filter(
      (img) => !referencedImages.includes(img)
    );
    for (const imgUrl of unused) {
      const key = imgUrl.split("/").pop();
      if (key) {
        await this.delete(key);
      }
    }
  },
};
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return types[ext.toLowerCase()] || "application/octet-stream";
}
