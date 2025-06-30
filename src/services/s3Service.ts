import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/utils/s3Client";

export interface UploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  folderPath?: string;
}

export interface UploadResponse {
  presignedUrl: string;
  fileName: string; // Just the filename, not the full key
  fileUrl: string;
}

export interface FileInfo {
  key: string;
  fileName: string;
  fullKey: string;
  size: number;
  lastModified: Date | undefined;
  url: string;
}

export interface ListFilesResponse {
  files: FileInfo[];
}

// Internal helper functions
function getBucketName(): string {
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("NEXT_PUBLIC_S3_BUCKET_NAME environment variable is not set");
  }
  return bucketName;
}

function getAwsRegion(): string {
  return process.env.AWS_REGION || "ap-southeast-1";
}

function generateFileUrl(key: string): string {
  const bucketName = getBucketName();
  const region = getAwsRegion();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

// Exported utility functions
export function constructFileUrl(fileName: string, folderPath?: string): string {
  const key = folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;
  return generateFileUrl(key);
}

export function constructS3Key(fileName: string, folderPath?: string): string {
  return folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;
}

// Main service functions
export async function createUploadUrl(request: UploadRequest): Promise<UploadResponse> {
  const { fileName, contentType, size, folderPath } = request;

  const uniqueFileName = `${uuidv4()}-${fileName}`;
  const s3Key = constructS3Key(uniqueFileName, folderPath);

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: s3Key,
    ContentType: contentType,
    ContentLength: size,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  const fileUrl = generateFileUrl(s3Key);

  return {
    presignedUrl,
    fileName: uniqueFileName,
    fileUrl,
  };
}

export async function listFiles(folderPath: string): Promise<ListFilesResponse> {
  // Ensure folder path ends with / for S3 listing
  const normalizedFolderPath = folderPath.endsWith("/")
    ? folderPath
    : `${folderPath}/`;

  const command = new ListObjectsV2Command({
    Bucket: getBucketName(),
    Prefix: normalizedFolderPath,
    MaxKeys: 1000,
  });

  const response = await s3Client.send(command);

  if (!response.Contents) {
    return { files: [] };
  }

  // Filter for image files and format the response
  const imageFiles = response.Contents
    .filter((obj) => {
      const key = obj.Key || "";
      const extension = key.toLowerCase().split(".").pop();
      return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
        extension || ""
      );
    })
    .map((obj) => {
      const key = obj.Key || "";
      const fileName = key.split("/").pop() || "";
      // Extract original filename by removing UUID prefix
      const originalFileName = fileName.includes("-")
        ? fileName.split("-").slice(1).join("-")
        : fileName;

      return {
        key: key,
        fileName: originalFileName,
        fullKey: key,
        size: obj.Size || 0,
        lastModified: obj.LastModified,
        url: generateFileUrl(key),
      };
    })
    .sort((a, b) => {
      const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return dateB - dateA; // Sort by newest first
    });

  return { files: imageFiles };
}

export async function deleteFile(fileNameOrKey: string, folderPath?: string): Promise<void> {
  const key = fileNameOrKey.includes("/") 
    ? fileNameOrKey 
    : constructS3Key(fileNameOrKey, folderPath);

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await s3Client.send(command);
} 