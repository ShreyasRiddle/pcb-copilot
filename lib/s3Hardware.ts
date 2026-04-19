import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveAwsRegion } from "./awsRegion";

const region = resolveAwsRegion();
const bucket = process.env.HARDWARE_PROJECTS_BUCKET;

function client() {
  return new S3Client({ region });
}

export function assertHardwareBucket(): string {
  if (!bucket) throw new Error("HARDWARE_PROJECTS_BUCKET is not configured");
  return bucket;
}

export function isS3HardwareConfigured(): boolean {
  return Boolean(bucket);
}

/** S3 object key for a project revision zip */
export function sourceZipKey(ownerSub: string, projectId: string, revisionId: string): string {
  return `users/${ownerSub}/projects/${projectId}/revisions/${revisionId}/source.zip`;
}

/** S3 object key for a project revision SKiDL script */
export function skidlPyKey(ownerSub: string, projectId: string, revisionId: string): string {
  return `users/${ownerSub}/projects/${projectId}/revisions/${revisionId}/circuit_skidl.py`;
}

export async function presignedPutZip(
  ownerSub: string,
  projectId: string,
  revisionId: string,
  contentType = "application/zip"
): Promise<{ url: string; key: string }> {
  const Key = sourceZipKey(ownerSub, projectId, revisionId);
  const cmd = new PutObjectCommand({
    Bucket: assertHardwareBucket(),
    Key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn: 3600 });
  return { url, key: Key };
}

export async function presignedGetZip(key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: assertHardwareBucket(),
    Key: key,
  });
  return getSignedUrl(client(), cmd, { expiresIn: 3600 });
}

export async function putObjectText(key: string, text: string, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: assertHardwareBucket(),
      Key: key,
      Body: text,
      ContentType: contentType,
    })
  );
}

export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  const b = assertHardwareBucket();
  await client().send(
    new CopyObjectCommand({
      Bucket: b,
      CopySource: `${b}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
      Key: destKey,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({
      Bucket: assertHardwareBucket(),
      Key: key,
    })
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({
      Bucket: assertHardwareBucket(),
      Key: key,
    })
  );
  const body = res.Body;
  if (!body) throw new Error("Empty S3 body");
  const anyBody = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof anyBody.transformToByteArray === "function") {
    const bytes = await anyBody.transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
