import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { ScamReport } from "@/types/scam-reports";
import { z } from "zod";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createScamReportSchema } from "@/schema/scam-reports";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { verifyAuth } from "@/utils/auth";
import axiosInstance from "@/utils/axios";

// Get single scam report by ID (requires createdAt in query)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await context.params;
  const { searchParams } = new URL(req.url);
  const createdAt = searchParams.get("createdAt");

  if (!createdAt) {
    return NextResponse.json(
      { error: "createdAt is required" },
      { status: 400 }
    );
  }

  try {
    const command = new GetCommand({
      TableName: "scam-reports",
      Key: {
        reportId,
        createdAt,
      },
    });
    const { Item } = await ddbDocClient.send(command);
    if (!Item) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ report: Item as ScamReport });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

// Update scam report
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await context.params;

  try {
    const body = await req.json();
    const validation = updateScamReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.message },
        { status: 400 }
      );
    }
    const { title, description, image, anonymized, createdAt } =
      validation.data;
    const updatedAt = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: "scam-reports",
      Key: {
        reportId,
        createdAt,
      },
      UpdateExpression:
        "set title = :title, description = :description, image = :image, anonymized = :anonymized, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":title": title,
        ":description": description,
        ":image": image,
        ":anonymized": anonymized,
        ":updatedAt": updatedAt,
      },
    });
    await ddbDocClient.send(command);
    return NextResponse.json(
      { message: "Scam report updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating scam report:", error);
    return NextResponse.json(
      { error: "Failed to update scam report" },
      { status: 500 }
    );
  }
}

const updateScamReportSchema = createScamReportSchema.extend({
  createdAt: z.string().min(1, "createdAt is required"),
});

// Delete scam report
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

const deleteReportSchema = z.object({
  createdAt: z.string().min(1, "createdAt is required"),
  image: z.string().min(1, "Image filename is required"),
});
