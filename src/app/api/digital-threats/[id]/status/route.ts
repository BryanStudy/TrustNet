import { verifyAuth } from "@/utils/auth";
import ddbDocClient from "@/utils/dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

// Update threat status
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: threatId } = await context.params;

  let userPayload;
  try {
    userPayload = await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  // Only admins can update threat status
  if (userPayload.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { createdAt, status } = await req.json();

    if (!createdAt || !status) {
      return NextResponse.json(
        { error: "createdAt and status are required" },
        { status: 400 }
      );
    }

    if (!["verified", "unverified"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be either 'verified' or 'unverified'" },
        { status: 400 }
      );
    }

    // Update the threat status in DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: "digital-threats",
      Key: {
        threatId: threatId,
        createdAt: createdAt,
      },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await ddbDocClient.send(updateCommand);

    return NextResponse.json({
      message: "Threat status updated successfully",
      threat: result.Attributes,
    });
  } catch (error) {
    console.error("Error updating threat status:", error);
    return NextResponse.json(
      { error: "Failed to update threat status" },
      { status: 500 }
    );
  }
}
