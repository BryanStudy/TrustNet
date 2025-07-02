import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { createDigitalThreatSchema } from "@/schema/digital-threats";

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
