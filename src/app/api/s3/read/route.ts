import { NextResponse } from "next/server";
import { z } from "zod";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client } from "@/utils/s3Client";

const readRequestSchema = z.object({
  folderPath: z.string(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get("folderPath");

    if (!folderPath) {
      return NextResponse.json(
        { error: "Folder path is required" },
        { status: 400 }
      );
    }

    const validation = readRequestSchema.safeParse({ folderPath });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid folder path" },
        { status: 400 }
      );
    }

    // Ensure folder path ends with / for S3 listing
    const normalizedFolderPath = folderPath.endsWith("/")
      ? folderPath
      : `${folderPath}/`;

    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME!,
      Prefix: normalizedFolderPath,
      MaxKeys: 1000, // Adjust as needed
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      return NextResponse.json({ files: [] }, { status: 200 });
    }

    // Filter for image files and format the response
    const imageFiles = response.Contents.filter((obj) => {
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
          url: `https://${process.env.S3_BUCKET_NAME}.s3.${
            process.env.AWS_REGION || "ap-southeast-1"
          }.amazonaws.com/${key}`,
        };
      })
      .sort((a, b) => {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA; // Sort by newest first
      });

    return NextResponse.json({ files: imageFiles }, { status: 200 });
  } catch (error) {
    console.error("Error reading S3 objects:", error);
    return NextResponse.json(
      { error: "Failed to read files from S3" },
      { status: 500 }
    );
  }
}
