import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
const local = process.env.STORAGE_DRIVER === "local";
const root =
  process.env.PETISH_OBJECTS_ROOT ||
  path.join(process.cwd(), ".local", "objects");
function keyPath(key: string) {
  if (!/^[a-f0-9-]+\/(?:(full|thumb)\.webp|document\.pdf)$/.test(key))
    throw new Error("Invalid object key");
  return path.join(/* turbopackIgnore: true */ root, key);
}
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: process.env.S3_ACCESS_KEY
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      }
    : undefined,
});
export async function putObject(
  key: string,
  data: Buffer,
  mime = "image/webp",
) {
  if (local) {
    if (process.env.PETISH_DEMO !== "true")
      throw new Error("Local storage is demo-only");
    const p = keyPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    return;
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: mime,
    }),
  );
}
export async function getObject(key: string) {
  if (local) return readFile(/* turbopackIgnore: true */ keyPath(key));
  const res = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  return Buffer.from(await res.Body!.transformToByteArray());
}
export async function deleteObject(key: string) {
  if (local) {
    await unlink(keyPath(key)).catch(() => {});
    return;
  }
  await s3.send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
