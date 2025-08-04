import { NextRequest, NextResponse } from "next/server";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { DigitalThreat } from "@/types/digital-threats";
import { createDigitalThreatSchema } from "@/schema/digital-threats";

// Get single threat by ID (requires POST with createdAt in body)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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

  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    // Fetch the threat
    const threatCommand = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    const { Item: threatItem } = await ddbDocClient.send(threatCommand);

    if (!threatItem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const threat = threatItem as DigitalThreat;

    // Fetch the user details
    let reporterName = "Unknown User";
    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: threat.submittedBy },
      });
      const { Item: userItem } = await ddbDocClient.send(userCommand);

      if (userItem && userItem.firstName && userItem.lastName) {
        reporterName = `${userItem.firstName} ${userItem.lastName}`;
      }
    } catch (userError) {
      // If user fetch fails, keep "Unknown User" as fallback
      console.error("Failed to fetch user:", userError);
    }

    return NextResponse.json({
      threat,
      reporterName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }
}

// Delete threat
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  // Check if item exists
  try {
    const getCmd = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    const { Item } = await ddbDocClient.send(getCmd);
    if (!Item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }

  // Cascade delete all threat-likes for this threatId
  let likeDeleteWarning = null;
  try {
    // Query all likes for this threatId using the GSI
    const queryCmd = new QueryCommand({
      TableName: "threat-likes",
      IndexName: "threatId-index",
      KeyConditionExpression: "threatId = :threatId",
      ExpressionAttributeValues: { ":threatId": id },
      ProjectionExpression: "userId, threatId",
    });
    const { Items } = await ddbDocClient.send(queryCmd);
    if (Items && Items.length > 0) {
      // Batch delete in chunks of 25
      for (let i = 0; i < Items.length; i += 25) {
        const batch = Items.slice(i, i + 25);
        const deleteRequests = batch.map((item) => ({
          DeleteRequest: {
            Key: { userId: item.userId, threatId: item.threatId },
          },
        }));
        const batchCmd = new BatchWriteCommand({
          RequestItems: {
            "threat-likes": deleteRequests,
          },
        });
        const batchRes = await ddbDocClient.send(batchCmd);
        if (
          batchRes.UnprocessedItems &&
          Object.keys(batchRes.UnprocessedItems).length > 0
        ) {
          likeDeleteWarning =
            "Some threat-likes could not be deleted. Please check the logs.";
        }
      }
    }
  } catch (error) {
    likeDeleteWarning =
      "Failed to delete some or all threat-likes. Please check the logs.";
  }

  // Delete the threat itself
  try {
    const deleteCmd = new DeleteCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    await ddbDocClient.send(deleteCmd);
    if (likeDeleteWarning) {
      return NextResponse.json({
        message: "Threat deleted, but some threat-likes may remain.",
        warning: likeDeleteWarning,
      });
    }
    return NextResponse.json({ message: "Threat deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete threat" },
      { status: 500 }
    );
  }
}

// Update threat
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  // Validate input (all fields optional)
  const partialSchema = createDigitalThreatSchema.partial();
  const validationResult = partialSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error.message },
      { status: 400 }
    );
  }

  // Fetch existing item
  let existing;
  try {
    const getCmd = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    const { Item } = await ddbDocClient.send(getCmd);
    if (!Item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    existing = Item;
  } catch (error) {
    console.log("Error fetching", error);
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }

  // Merge fields
  const { artifact, type, description } = body;
  const updatedAt = new Date().toISOString();
  const updateFields = {
    artifact: artifact ?? existing.artifact,
    type: type ?? existing.type,
    description: description ?? existing.description,
    updatedAt,
  };

  // Update item
  try {
    const updateCmd = new UpdateCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
      UpdateExpression:
        "set artifact = :artifact, #type = :type, description = :description, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#type": "type",
      },
      ExpressionAttributeValues: {
        ":artifact": updateFields.artifact,
        ":type": updateFields.type,
        ":description": updateFields.description,
        ":updatedAt": updateFields.updatedAt,
      },
    });
    await ddbDocClient.send(updateCmd);
    return NextResponse.json({ message: "Threat updated successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update threat" },
      { status: 500 }
    );
  }
}
