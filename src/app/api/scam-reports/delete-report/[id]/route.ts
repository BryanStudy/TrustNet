import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import axiosInstance from "@/utils/axios";

const deleteReportSchema = z.object({
  createdAt: z.string().min(1, "createdAt is required"),
  image: z.string().min(1, "Image filename is required"),
});

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await context.params;

  try {
    await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = deleteReportSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.message },
      { status: 400 }
    );
  }
  const { createdAt, image } = validation.data;

  try {
    // Delete the report from DynamoDB
    const deleteCommand = new DeleteCommand({
      TableName: "scam-reports",
      Key: { reportId, createdAt },
    });
    await ddbDocClient.send(deleteCommand);

    // Delete the image from S3 via the internal API using axios
    try {
      await axiosInstance.delete("/s3", {
        data: {
          key: image,
          folderPath: "scam-reports",
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: "Report deleted but failed to delete image from S3" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Scam report and image deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete scam report" },
      { status: 500 }
    );
  }
}
