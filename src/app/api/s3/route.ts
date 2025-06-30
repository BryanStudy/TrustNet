import { NextResponse } from "next/server";
import { z } from "zod";
import { createUploadUrl, listFiles, deleteFile } from "@/services/s3Service";

const uploadRequestSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "Content type is required").refine(
    (contentType) => contentType.startsWith("image/"),
    "Only image files are allowed"
  ),
  size: z.number().positive("File size must be positive").max(5 * 1024 * 1024, "File size cannot exceed 5MB"),
  folderPath: z.string().optional(),
});

const readRequestSchema = z.object({
  folderPath: z.string(),
});

const deleteRequestSchema = z.object({
  key: z.string(),
  folderPath: z.string().optional(),
});

// POST - Create presigned URL for upload
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = uploadRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const uploadResponse = await createUploadUrl(validation.data);
    return NextResponse.json(uploadResponse, { status: 200 });
  } catch (error) {
    console.error("Error creating presigned URL:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET - List files in folder
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
        { error: "Invalid folder path", details: validation.error.issues },
        { status: 400 }
      );
    }

    const filesResponse = await listFiles(folderPath);
    return NextResponse.json(filesResponse, { status: 200 });
  } catch (error) {
    console.error("Error reading S3 objects:", error);
    return NextResponse.json(
      { 
        error: "Failed to read files from S3",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete file
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const validation = deleteRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body - key is required", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { key, folderPath } = validation.data;
    await deleteFile(key, folderPath);

    return NextResponse.json(
      { message: "File deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting S3 object:", error);
    return NextResponse.json(
      { 
        error: "Failed to delete file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
