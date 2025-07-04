import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { createScamReportSchema } from "@/schema/scam-reports";

const updateScamReportSchema = createScamReportSchema.extend({
  createdAt: z.string().min(1, "createdAt is required"),
});

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
